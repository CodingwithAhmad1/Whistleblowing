"""Admin settings endpoints for persistent configuration."""

import copy
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Body

from ..prompts.display_content import DEFAULT_Q2_PROMPT_TEMPLATE, DEFAULT_Q3_PROMPT_TEMPLATE
from ..prompts.intake_gaps import DEFAULT_INTAKE_GAPS
from ..settings import get_settings, update_settings, get_intake_gaps, update_intake_gaps, get_last_analysis, _slugify
from ..llm.usage_tracker import get_tracker
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


@router.get("/admin/usage")
def admin_get_usage():
    """Return today's per-model usage statistics and the currently active model."""
    tracker = get_tracker()
    return {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "active_model": get_active_model(),
        "models": tracker.get_today_summary(),
        "cumulative": tracker.get_cumulative_summary(),
    }


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
    # Default template_conditional to None
    if "template_conditional" not in gap:
        gap["template_conditional"] = None

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


@router.get("/admin/last-intake-analysis")
def admin_get_last_intake_analysis():
    """Return the most recent intake analysis result, or null if none has been run."""
    return {"result": get_last_analysis()}
