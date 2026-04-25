"""ReportIQ FastAPI MCP: health, intake, RAG, and optional Q2/Q3 generators."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP(
    "reportiq",
    instructions=(
        "Tools call the ReportIQ backend (FastAPI) at REPORTIQ_API_BASE. "
        "The submission Feed is browser localStorage; use a browser to verify /feed. "
        "Use reportiq_intake_analyze for AI gap analysis; chain reportiq_rag_construct_sentence then "
        "reportiq_rag_policy_quote to mirror the in-app RAG steps."
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
