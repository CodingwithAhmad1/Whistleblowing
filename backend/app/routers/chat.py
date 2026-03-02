"""WebSocket chat router for real-time LLM interaction."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import logging
import asyncio

from ..llm import get_provider
from ..storage import session_store
from ..prompts import build_system_prompt
from ..prompts.layer1_classify import build_classify_prompt
from ..prompts.layer2_execute import build_execution_prompt
from ..prompts.response_types import normalize_response_type

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/chat/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for streaming chat.
    Two-layer workflow: classify response type, then execute accordingly.
    """
    await websocket.accept()
    logger.info(f"WebSocket connection established for session {session_id}")
    session = session_store.get_or_create_session(session_id)

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") != "message":
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message type. Expected 'message'."
                })
                continue

            user_message = data.get("content", "").strip()
            if not user_message:
                await websocket.send_json({
                    "type": "error",
                    "message": "Message content cannot be empty."
                })
                continue

            session.add_message("user", user_message)
            provider = get_provider()

            try:
                # Layer 1: Classify response type (low tokens)
                classify_prompt = build_classify_prompt(
                    user_message,
                    session.report_data,
                    session.conversation_history[-6:],
                )
                classification = ""
                async for token in provider.generate_stream(classify_prompt, max_tokens=20):
                    classification += token
                response_type = normalize_response_type(classification)
                logger.debug(f"Classified as: {response_type}")

                # Layer 2: Execute based on type
                exec_prompt = build_execution_prompt(
                    response_type,
                    session.report_data,
                    session.conversation_history,
                    user_message,
                )
                assistant_response = ""
                async for token in provider.generate_stream(exec_prompt):
                    assistant_response += token
                    await websocket.send_json({"type": "token", "content": token})

                session.add_message("assistant", assistant_response)

                if response_type == "extract_data":
                    extracted = session.extract_json_from_response(assistant_response)
                    if extracted and extracted.get("data"):
                        session.update_report(extracted["data"])
                        await websocket.send_json({
                            "type": "report_update",
                            "data": extracted["data"]
                        })
                        await asyncio.sleep(0.001)

                await websocket.send_json({"type": "done"})

            except Exception as e:
                logger.error(f"Error generating response: {e}", exc_info=True)
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass


@router.get("/reports/{session_id}")
async def get_report(session_id: str):
    """Get current report state for a session."""
    session = session_store.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "created_at": session.created_at.isoformat(),
        "report": session.report_data,
        "message_count": len(session.conversation_history)
    }


@router.post("/reports/{session_id}/reset")
async def reset_report(session_id: str):
    """Reset a session (clear history and report data)."""
    session = session_store.reset_session(session_id)
    
    return {
        "session_id": session_id,
        "status": "reset",
        "created_at": session.created_at.isoformat()
    }


@router.get("/sessions/{session_id}/history")
async def get_history(session_id: str):
    """Get conversation history for a session."""
    session = session_store.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "history": session.conversation_history
    }
