"""Question content generation endpoints for Full Details Q2, Q3, and intake analysis."""

import logging
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Body

from ..question_processors import get_processor
from ..question_processors.intake_processor import IntakeProcessor
from ..settings import update_last_analysis

router = APIRouter()
logger = logging.getLogger(__name__)

_intake_processor = IntakeProcessor()


def _extract_report(body: dict[str, Any]) -> dict[str, Any]:
    """Validate and extract report dict from request body."""
    report = body.get("report")
    if report is None:
        report = {}
    if not isinstance(report, dict):
        raise HTTPException(status_code=400, detail="report must be an object")
    return report


async def _generate_question(key: Literal["q2", "q3"], body: dict[str, Any]) -> dict[str, Any]:
    """Shared handler: extract report, run processor. No fallback — AI must always generate."""
    report = _extract_report(body)
    processor = get_processor(key)
    try:
        return await processor.process(report)
    except ValueError as e:
        logger.warning(f"{key} generation failed (bad input): {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        logger.error(f"{key} generation failed (runtime): {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")
    except Exception as e:
        logger.exception(f"{key} generation unexpected error")
        raise HTTPException(status_code=500, detail="Internal error generating content")


@router.post("/questions/q2/generate")
async def generate_q2(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Generate Q2 content from report data.
    Body: { "report": { ... } }
    Returns: { "content": str }
    """
    return await _generate_question("q2", body)


@router.post("/questions/q3/generate")
async def generate_q3(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Generate Q3 policy excerpt and question from report data.
    Body: { "report": { ... } }
    Returns: { "policyExcerpt": str, "question": str }
    """
    return await _generate_question("q3", body)


@router.post("/questions/intake/analyze")
async def intake_analyze(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Run 3-layer deterministic intake analysis on Q1 narrative text.
    Body: { "q1_text": str }
    Returns: {
      "extraction": { ...Layer1JSON },
      "gaps": ["gap_id_1", ...],
      "follow_up_questions": [{ "gap_id": str, "question_text": str }]
    }
    """
    q1_text = body.get("q1_text", "")
    if not isinstance(q1_text, str) or not q1_text.strip():
        raise HTTPException(status_code=422, detail="q1_text must be a non-empty string")
    form_data = body.get("form_data")
    if form_data is not None and not isinstance(form_data, dict):
        form_data = None
    try:
        result = await _intake_processor.process(q1_text.strip(), form_data)
        # Persist result for the Analysis page (best-effort — never blocks response)
        try:
            stamped = dict(result)
            stamped["timestamp"] = datetime.now(timezone.utc).isoformat()
            update_last_analysis(stamped)
        except Exception:
            logger.warning("Failed to persist intake analysis result", exc_info=True)
        return result
    except ValueError as e:
        logger.warning(f"Intake analyze bad input: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Intake analyze unexpected error")
        raise HTTPException(status_code=500, detail="Internal error during intake analysis")
