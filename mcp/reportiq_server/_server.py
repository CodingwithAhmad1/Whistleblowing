"""ReportIQ FastAPI MCP: health, intake, RAG, and optional Q2/Q3 generators."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "reportiq",
    instructions=(
        "Tools call the ReportIQ backend (FastAPI) at REPORTIQ_API_BASE. "
        "reportiq_intake_analyze returns extraction AFTER deterministic merge of form_data "
        "(summary fallbacks, entity merge, boolean OR from structured fields—see reportiq://form-schema). "
        "Follow-up question strings come from server gap config (intakeGaps in settings, else repo defaults). "
        "If Q2 text looks outdated vs docs, run GET /api/intake/gaps or reset gaps in Admin. "
        "The submission Feed is stored via POST/GET/DELETE /api/submissions (file-backed in backend/data; "
        "use reportiq_submission_create to append without a browser, then open /feed in the app to confirm). "
        "Chain reportiq_rag_construct_sentence then reportiq_rag_policy_quote to mirror the in-app RAG steps. "
        "For a second pass after follow-ups, use reportiq_intake_with_followup_answers or pass full_details_q2 "
        "in form_data to reportiq_intake_analyze."
    ),
)


def _base_url() -> str:
    return os.environ.get("REPORTIQ_API_BASE", "http://127.0.0.1:8000").rstrip("/")


async def _get_json(
    path: str,
) -> Any:
    url = f"{_base_url()}{path}"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=60.0)
        r.raise_for_status()
        return r.json()


async def _post_json(
    path: str,
    body: dict[str, Any],
) -> Any:
    url = f"{_base_url()}{path}"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            url,
            json=body,
            timeout=120.0,
        )
        if r.is_success:
            return r.json()
        try:
            detail = r.json()
        except Exception:
            detail = r.text
        return {
            "error": f"HTTP {r.status_code}",
            "status_code": r.status_code,
            "detail": detail,
        }


async def _delete(
    path: str,
) -> Any:
    url = f"{_base_url()}{path}"
    async with httpx.AsyncClient() as client:
        r = await client.delete(url, timeout=30.0)
        if r.is_success or r.status_code == 204:
            try:
                return r.json() if r.content else {"ok": True}
            except Exception:
                return {"ok": True}
        try:
            detail = r.json()
        except Exception:
            detail = r.text
        return {
            "error": f"HTTP {r.status_code}",
            "status_code": r.status_code,
            "detail": detail,
        }


@mcp.tool()
async def reportiq_health() -> dict[str, Any]:
    """GET /api/health — backend and Gemini provider status (ready flag may be false until warm)."""
    return await _get_json("/api/health")


@mcp.tool()
async def reportiq_intake_analyze(
    q1_text: str,
    form_data: dict[str, str] | None = None,
) -> dict[str, Any]:
    """POST /api/questions/intake/analyze — Layer1 extraction, gap IDs, and 0–2 follow-up questions.

    q1_text: primary narrative (same as frontend buildAnalysisText or full_details_q1).
    form_data: optional flat string fields from the report form for context.
    """
    if not (q1_text and q1_text.strip()):
        return {"error": "q1_text must be a non-empty string"}
    body: dict[str, Any] = {"q1_text": q1_text.strip()}
    if form_data is not None:
        body["form_data"] = form_data
    return await _post_json("/api/questions/intake/analyze", body)


@mcp.tool()
async def reportiq_intake_with_followup_answers(
    q1_text: str,
    form_data: dict[str, str] | None = None,
    full_details_q2: str | None = None,
    full_details_gap2: str | None = None,
) -> dict[str, Any]:
    """Call intake after merging follow-up answer fields into ``form_data``.

    The backend appends ``full_details_q2`` and ``full_details_gap2`` to the same
    combined narrative as ``sequence_of_events`` and ``evidence_description``. Use
    after a first ``reportiq_intake_analyze`` to simulate answering AI follow-up
    questions without editing the full form by hand.
    """
    if not (q1_text and q1_text.strip()):
        return {"error": "q1_text must be a non-empty string"}
    fd: dict[str, str] = dict(form_data) if form_data else {}
    if full_details_q2 and str(full_details_q2).strip():
        fd["full_details_q2"] = str(full_details_q2).strip()
    if full_details_gap2 and str(full_details_gap2).strip():
        fd["full_details_gap2"] = str(full_details_gap2).strip()
    return await _post_json(
        "/api/questions/intake/analyze",
        {"q1_text": q1_text.strip(), "form_data": fd},
    )


@mcp.tool()
async def reportiq_rag_construct_sentence(
    form_data: dict[str, str],
) -> dict[str, Any]:
    """POST /api/rag/construct-sentence — LLM one-line case summary for policy query."""
    return await _post_json("/api/rag/construct-sentence", {"form_data": form_data})


@mcp.tool()
async def reportiq_rag_policy_quote(
    form_data: dict[str, str],
    constructed_sentence: str | None = None,
) -> dict[str, Any]:
    """POST /api/rag/policy-quote — RAG top policy quote and section. Prefer constructed_sentence when set."""
    body: dict[str, Any] = {"form_data": form_data}
    if constructed_sentence and constructed_sentence.strip():
        body["constructed_sentence"] = constructed_sentence.strip()
    return await _post_json("/api/rag/policy-quote", body)


@mcp.tool()
async def reportiq_intake_gaps() -> dict[str, Any]:
    """GET /api/intake/gaps — public gap configuration (ordered)."""
    return await _get_json("/api/intake/gaps")


@mcp.tool()
async def reportiq_submission_create(
    form_data: dict[str, str],
    timestamp_iso: str | None = None,
    gaps: list[str] | None = None,
    follow_up_questions: list[dict[str, str]] | None = None,
    extraction: dict[str, Any] | None = None,
    extraction_breakdown: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """POST /api/submissions — append a row to the shared Feed (same as in-app Submit).

    Pass flat string fields in form_data (see reportiq://form-schema). Optionally run
    reportiq_intake_analyze and pass its extraction, extraction_breakdown, gaps, and
    follow_up_questions to mirror a full client submit.
    """
    ts = (timestamp_iso or "").strip()
    if not ts:
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    body: dict[str, Any] = {
        "timestamp": ts,
        "formData": form_data,
        "gaps": list(gaps) if gaps else [],
        "followUpQuestions": _normalize_follow_ups(follow_up_questions or []),
        "extraction": extraction,
        "extractionBreakdown": extraction_breakdown,
    }
    if not form_data or not any(str(v).strip() for v in form_data.values() if v is not None):
        return {"error": "form_data must include at least one non-empty field"}
    return await _post_json("/api/submissions", body)


def _normalize_follow_ups(
    items: list[dict[str, str]],
) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for x in items:
        if not isinstance(x, dict):
            continue
        gid = x.get("gap_id", "")
        qt = x.get("question_text", "")
        if isinstance(gid, str) and isinstance(qt, str) and (gid or qt):
            out.append({"gap_id": gid, "question_text": qt})
    return out


@mcp.tool()
async def reportiq_submission_list() -> list[dict[str, Any]] | dict[str, Any]:
    """GET /api/submissions — list all feed rows (id, timestamp, formData, extraction, etc.)."""
    return await _get_json("/api/submissions")


@mcp.tool()
async def reportiq_submission_delete(submission_id: int) -> dict[str, Any]:
    """DELETE /api/submissions/{id} — remove a feed row."""
    if submission_id < 1:
        return {"error": "submission_id must be a positive integer"}
    return await _delete(f"/api/submissions/{submission_id}")


@mcp.tool()
async def reportiq_q2_generate(report: dict[str, Any] | None = None) -> dict[str, Any]:
    """POST /api/questions/q2/generate — optional legacy Q2 content from full report object."""
    return await _post_json("/api/questions/q2/generate", {"report": report or {}})


@mcp.tool()
async def reportiq_q3_generate(report: dict[str, Any] | None = None) -> dict[str, Any]:
    """POST /api/questions/q3/generate — optional Q3 policy excerpt + question from report."""
    return await _post_json("/api/questions/q3/generate", {"report": report or {}})


@mcp.resource("reportiq://form-schema", mime_type="application/json")
def reportiq_form_schema() -> str:
    """JSON overview of report field keys and conditional display rules (see frontend types/report)."""
    path = Path(__file__).resolve().parent / "form_schema.json"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return "{}"
