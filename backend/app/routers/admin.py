"""Admin settings endpoints for persistent configuration."""

import copy
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Body

from ..prompts.display_content import DEFAULT_Q2_PROMPT_TEMPLATE, DEFAULT_Q3_PROMPT_TEMPLATE
from ..prompts.intake_gaps import DEFAULT_INTAKE_GAPS
from ..settings import get_settings, update_settings, get_intake_gaps, update_intake_gaps, _slugify
from ..llm.model_fallback import get_active_model

router = APIRouter()
logger = logging.getLogger(__name__)


def _admin_settings_response(data: dict) -> dict:
    """Shape settings for API response: strip apiKey and policyExcerpt, add default prompts."""
    out = dict(data)
    out.pop("apiKey", None)
    out.pop("policyExcerpt", None)
    out["defaultQ2PromptTemplate"] = DEFAULT_Q2_PROMPT_TEMPLATE
    out["defaultQ3PromptTemplate"] = DEFAULT_Q3_PROMPT_TEMPLATE
    return out


@router.get("/admin/settings")
def admin_get_settings():
    """Return current admin settings plus default prompts for display. apiKey omitted (backend-only)."""
    return _admin_settings_response(get_settings())


@router.put("/admin/settings")
def admin_update_settings(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Update admin settings.
    Body: { "policyExcerpt"?: string, "q2PromptTemplate"?: string, "q3PromptTemplate"?: string }
    API key is backend-only (GEMINI_API_KEY in .env).
    """
    updates = {}
    if "apiKey" in body:
        updates["apiKey"] = body["apiKey"]
    if "q2PromptTemplate" in body:
        updates["q2PromptTemplate"] = body["q2PromptTemplate"]
    if "q3PromptTemplate" in body:
        updates["q3PromptTemplate"] = body["q3PromptTemplate"]
    if not updates:
        return _admin_settings_response(get_settings())
    try:
        result = update_settings(updates)
        return _admin_settings_response(result)
    except Exception:
        logger.exception("Admin settings update failed")
        raise HTTPException(status_code=500, detail="Failed to update settings")


# ── Intake Gap CRUD ───────────────────────────────────────────────────────────

@router.get("/admin/intake-gaps")
def admin_get_intake_gaps():
    """Return current intake gap configurations (ordered by priority)."""
    return {"gaps": get_intake_gaps()}


@router.put("/admin/intake-gaps")
def admin_replace_intake_gaps(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Replace the full ordered list of intake gap configurations.
    Body: { "gaps": [ ...gap objects... ] }
    """
    gaps = body.get("gaps")
    if not isinstance(gaps, list):
        raise HTTPException(status_code=400, detail="Body must contain 'gaps' array")
    try:
        saved = update_intake_gaps(gaps)
        return {"gaps": saved}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Failed to update intake gaps")
        raise HTTPException(status_code=500, detail="Failed to update intake gaps")


@router.post("/admin/intake-gaps")
def admin_add_intake_gap(body: dict[str, Any] = Body(default_factory=dict)):
    """
    Add a new intake gap to the list. Auto-generates id from label if not provided.
    Body: { gap object without id, or with id }
    """
    gap = dict(body)
    # Auto-generate id from label if not provided
    if not gap.get("id"):
        label = gap.get("label", "")
        base_slug = _slugify(label) if label else "gap"
        existing_ids = {g["id"] for g in get_intake_gaps()}
        slug = base_slug
        counter = 1
        while slug in existing_ids:
            slug = f"{base_slug}_{counter}"
            counter += 1
        gap["id"] = slug

    current = get_intake_gaps()
    # Assign next priority if not set
    if "priority" not in gap or not isinstance(gap.get("priority"), int):
        max_priority = max((g.get("priority", 0) for g in current), default=0)
        gap["priority"] = max_priority + 1
    # Default active to True
    if "active" not in gap:
        gap["active"] = True
    current.append(gap)
    try:
        saved = update_intake_gaps(current)
        return {"gaps": saved}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Failed to add intake gap")
        raise HTTPException(status_code=500, detail="Failed to add intake gap")


@router.put("/admin/intake-gaps/{gap_id}")
def admin_update_intake_gap(gap_id: str, body: dict[str, Any] = Body(default_factory=dict)):
    """
    Update a single gap by id. Merges provided fields into existing gap.
    Body: partial gap object (any subset of gap fields)
    """
    current = get_intake_gaps()
    idx = next((i for i, g in enumerate(current) if g["id"] == gap_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail=f"Gap '{gap_id}' not found")

    updated_gap = {**current[idx], **body}
    updated_gap["id"] = gap_id  # id is immutable via this endpoint
    current[idx] = updated_gap

    try:
        saved = update_intake_gaps(current)
        return {"gaps": saved}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Failed to update intake gap")
        raise HTTPException(status_code=500, detail="Failed to update intake gap")


@router.delete("/admin/intake-gaps/{gap_id}")
def admin_delete_intake_gap(gap_id: str):
    """Delete a gap by id."""
    current = get_intake_gaps()
    new_gaps = [g for g in current if g["id"] != gap_id]
    if len(new_gaps) == len(current):
        raise HTTPException(status_code=404, detail=f"Gap '{gap_id}' not found")
    try:
        saved = update_intake_gaps(new_gaps)
        return {"gaps": saved}
    except Exception:
        logger.exception("Failed to delete intake gap")
        raise HTTPException(status_code=500, detail="Failed to delete intake gap")


@router.post("/admin/intake-gaps/reset")
def admin_reset_intake_gaps():
    """Reset intake gap configurations to the original defaults."""
    try:
        saved = update_intake_gaps(copy.deepcopy(DEFAULT_INTAKE_GAPS))
        return {"gaps": saved}
    except Exception:
        logger.exception("Failed to reset intake gaps to defaults")
        raise HTTPException(status_code=500, detail="Failed to reset intake gaps")


@router.post("/admin/gemini-test")
def admin_gemini_test():
    """Test the Gemini API connection by making a minimal LLM call."""
    try:
        from ..llm.genai_config import get_client
        from google.genai import types

        model = get_active_model()
        client = get_client()
        response = client.models.generate_content(
            model=model,
            contents="Say hi",
            config=types.GenerateContentConfig(max_output_tokens=5),
        )
        text = response.text or ""
        return {"success": True, "model": model, "response": text.strip(), "error": None}
    except Exception as e:
        error_msg = str(e)
        # Sanitize: strip API key from error message if present
        try:
            from ..llm.genai_config import _last_configured_key
            if _last_configured_key and _last_configured_key in error_msg:
                error_msg = error_msg.replace(_last_configured_key, "***")
        except Exception:
            pass
        logger.warning(f"Gemini test failed: {error_msg}")
        return {"success": False, "model": None, "response": None, "error": error_msg}


# ── AI Pipeline Diagnostics ──────────────────────────────────────────────────

@router.get("/admin/test/fixtures")
def admin_get_test_fixtures():
    """Return available test fixtures for the AI pipeline test."""
    from ..testing.fixtures import TEST_FIXTURES
    return {"fixtures": TEST_FIXTURES}


@router.post("/admin/test/ai-pipeline")
async def admin_run_pipeline_test(body: dict[str, Any] = Body(default_factory=dict)):
    """Run the AI pipeline test for one or all fixtures.

    Body: { "fixture_id"?: str }
    If fixture_id is provided, run only that fixture. Otherwise run all.
    """
    from ..testing.fixtures import TEST_FIXTURES
    from ..testing.pipeline_runner import run_pipeline_test
    from ..testing.history import append_test_result

    fixture_id = body.get("fixture_id")

    if fixture_id:
        fixture = next((f for f in TEST_FIXTURES if f["id"] == fixture_id), None)
        if not fixture:
            raise HTTPException(status_code=404, detail=f"Fixture '{fixture_id}' not found")
        fixtures_to_run = [fixture]
    else:
        fixtures_to_run = TEST_FIXTURES

    results = []
    for fixture in fixtures_to_run:
        result = await run_pipeline_test(fixture)
        results.append(result)
        # Persist each result
        try:
            append_test_result(result)
        except Exception:
            logger.warning("Failed to persist test result", exc_info=True)

    overall = "pass" if all(r["overall_status"] == "pass" for r in results) else "fail"
    return {"overall_status": overall, "results": results}


@router.get("/admin/test/history")
def admin_get_test_history():
    """Return stored test history."""
    from ..testing.history import read_test_history
    return {"history": read_test_history()}


@router.delete("/admin/test/history")
def admin_clear_test_history():
    """Clear all test history."""
    from ..testing.history import clear_test_history
    clear_test_history()
    return {"cleared": True}
