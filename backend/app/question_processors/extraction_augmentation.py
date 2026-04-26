"""
Merge Layer 1 LLM extraction with structured form data for coherent Feed / investigator output.

This runs after the LLM step and before gap detection. It OR-infers booleans and entity
lists from explicit form fields only (no new LLM calls). It does not set witnesses,
impact, or retaliation from form alone to avoid false positives.
"""

from __future__ import annotations

from typing import Any, cast

from .intake_processor import Layer1Result

# Aligns with sequence-based suppression in intake_processor.
_MIN_SUBSTANTIVE_SEQUENCE_CHARS = 60
_MIN_EVIDENCE_TEXT_CHARS = 20
_MAX_SUMMARY_CHARS = 1200


def _s(v: object) -> str:
    if v is None:
        return ""
    if not isinstance(v, str):
        return str(v).strip()
    return v.strip()


def _nonempty_line(s: str) -> bool:
    t = s.strip()
    return len(t) >= 2 and t.lower() not in (
        "n/a",
        "na",
        "none",
        "unknown",
        "tbd",
        "-",
        "—",
    )


def _merge_dedupe_unique(existing: list[str], extra: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in list(existing) + list(extra):
        t = (x or "").strip()
        if not t:
            continue
        key = t.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(t)
    return out


def _people_from_form(form_data: dict) -> list[str]:
    names: list[str] = []
    for i in range(1, 11):
        first = _s(form_data.get(f"person_{i}_first"))
        last = _s(form_data.get(f"person_{i}_last"))
        if not first and not last:
            continue
        full = f"{first} {last}".strip()
        if full:
            names.append(full)
    return names


def _locations_from_form(form_data: dict) -> list[str]:
    out: list[str] = []
    for key in ("where_occurred", "incident_location", "country"):
        v = _s(form_data.get(key))
        if v:
            out.append(v)
    return out


def build_fallback_summary(form_data: dict) -> str:
    """Stitch a neutral paragraph from form fields when the LLM summary is empty."""
    parts: list[str] = []
    nature = _s(form_data.get("general_nature"))
    if _nonempty_line(nature):
        parts.append(nature)
    when = _s(form_data.get("when_occurred"))
    where = _s(form_data.get("where_occurred")) or _s(form_data.get("incident_location"))
    details: list[str] = []
    if _nonempty_line(when):
        details.append(f"When: {when}.")
    if _nonempty_line(where):
        details.append(f"Where: {where}.")
    if details:
        parts.append(" ".join(details))
    how = _s(form_data.get("how_aware"))
    how_o = _s(form_data.get("how_aware_other"))
    if _nonempty_line(how) or _nonempty_line(how_o):
        h = f"{how} {how_o}".strip() if how_o else how
        if _nonempty_line(h):
            parts.append(f"How the reporter became aware: {h.strip()}.")
    text = " ".join(p for p in parts if p).strip()
    if len(text) > _MAX_SUMMARY_CHARS:
        return text[: _MAX_SUMMARY_CHARS - 1].rstrip() + "…"
    return text


def _append_structured_context_if_missing(summary: str, form_data: dict) -> str:
    when = _s(form_data.get("when_occurred"))
    where = _s(form_data.get("where_occurred")) or _s(form_data.get("incident_location"))
    if not _nonempty_line(when) and not _nonempty_line(where):
        return summary
    s_low = summary.casefold()
    if when and when.casefold() in s_low and (not where or where.casefold() in s_low):
        return summary
    if when and when.casefold() in s_low and not where:
        return summary
    if where and where.casefold() in s_low and not when:
        return summary
    bits: list[str] = []
    if _nonempty_line(when) and when.casefold() not in s_low:
        bits.append(f"When: {when}")
    if _nonempty_line(where) and where.casefold() not in s_low:
        bits.append(f"Where: {where}")
    if not bits:
        return summary
    add = " Structured form context: " + "; ".join(bits) + "."
    combined = (summary.rstrip() + add).strip()
    if len(combined) > _MAX_SUMMARY_CHARS:
        return combined[: _MAX_SUMMARY_CHARS - 1].rstrip() + "…"
    return combined


def augment_extraction_with_form(
    layer1: Layer1Result,
    form_data: dict | None,
) -> Layer1Result:
    if not form_data:
        return layer1

    fd = form_data
    used_defaults = bool(layer1.get("_used_defaults", False))
    raw_sum = _s(layer1.get("summary", ""))

    when_line = _s(fd.get("when_occurred"))
    date_additions = [when_line] if _nonempty_line(when_line) else []
    dates_mentioned = _merge_dedupe_unique(layer1.get("dates_mentioned") or [], date_additions)
    locations_mentioned = _merge_dedupe_unique(
        layer1.get("locations_mentioned") or [],
        _locations_from_form(fd),
    )
    people_mentioned = _merge_dedupe_unique(
        layer1.get("people_mentioned") or [],
        _people_from_form(fd),
    )

    if used_defaults or not raw_sum:
        fallback = build_fallback_summary(fd)
        summary_out = fallback or raw_sum
    else:
        summary_out = _append_structured_context_if_missing(raw_sum, fd)

    seq = _s(fd.get("sequence_of_events"))
    ev = _s(fd.get("evidence_description"))
    has_mats = _s(fd.get("has_supporting_materials")).lower() == "yes"
    dur = _s(fd.get("duration"))
    mgmt = _s(fd.get("management_aware")).lower()

    timeline_clear = bool(
        layer1.get("timeline_clear")
        or _nonempty_line(when_line)
        or _nonempty_line(dur)
        or len(seq) >= _MIN_SUBSTANTIVE_SEQUENCE_CHARS
    )
    evidence_described = bool(
        layer1.get("evidence_described")
        or (has_mats and len(ev) >= _MIN_EVIDENCE_TEXT_CHARS)
    )
    specific_examples_present = bool(
        layer1.get("specific_examples_present")
        or len(seq) >= _MIN_SUBSTANTIVE_SEQUENCE_CHARS
    )
    prior_reporting_mentioned = bool(layer1.get("prior_reporting_mentioned") or mgmt == "yes")

    return cast(
        Layer1Result,
        {
            "summary": summary_out,
            "dates_mentioned": dates_mentioned,
            "people_mentioned": people_mentioned,
            "locations_mentioned": locations_mentioned,
            "specific_examples_present": specific_examples_present,
            "evidence_described": evidence_described,
            "timeline_clear": timeline_clear,
            "witnesses_mentioned": layer1.get("witnesses_mentioned", False),
            "prior_reporting_mentioned": prior_reporting_mentioned,
            "impact_described": layer1.get("impact_described", False),
            "retaliation_mentioned": layer1.get("retaliation_mentioned", False),
            "allegation_type": list(layer1.get("allegation_type") or []),
            "length_character_count": layer1.get("length_character_count", 0),
            "_used_defaults": used_defaults,
        },
    )


def algorithmic_from_form(form_data: dict | None) -> dict[str, Any]:
    """Facts and flags derivable from structured form fields only (no LLM)."""
    if not form_data:
        return {
            "dates_mentioned": [],
            "people_mentioned": [],
            "locations_mentioned": [],
            "specific_examples_present": False,
            "evidence_described": False,
            "timeline_clear": False,
            "prior_reporting_mentioned": False,
        }

    fd = form_data
    when_line = _s(fd.get("when_occurred"))
    date_additions = [when_line] if _nonempty_line(when_line) else []
    seq = _s(fd.get("sequence_of_events"))
    ev = _s(fd.get("evidence_description"))
    has_mats = _s(fd.get("has_supporting_materials")).lower() == "yes"
    dur = _s(fd.get("duration"))
    mgmt = _s(fd.get("management_aware")).lower()

    return {
        "dates_mentioned": list(date_additions),
        "people_mentioned": _people_from_form(fd),
        "locations_mentioned": _locations_from_form(fd),
        "specific_examples_present": bool(len(seq) >= _MIN_SUBSTANTIVE_SEQUENCE_CHARS),
        "evidence_described": bool(has_mats and len(ev) >= _MIN_EVIDENCE_TEXT_CHARS),
        "timeline_clear": bool(
            _nonempty_line(when_line) or _nonempty_line(dur) or len(seq) >= _MIN_SUBSTANTIVE_SEQUENCE_CHARS
        ),
        "prior_reporting_mentioned": mgmt == "yes",
    }


def layer1_to_public_model_slice(layer1: Layer1Result) -> dict[str, Any]:
    """Pre-merge Layer 1 fields for the narrative-inference (model) view."""
    out: dict[str, Any] = {
        "summary": _s(layer1.get("summary", "")),
        "dates_mentioned": list(layer1.get("dates_mentioned") or []),
        "people_mentioned": list(layer1.get("people_mentioned") or []),
        "locations_mentioned": list(layer1.get("locations_mentioned") or []),
        "specific_examples_present": bool(layer1.get("specific_examples_present", False)),
        "evidence_described": bool(layer1.get("evidence_described", False)),
        "timeline_clear": bool(layer1.get("timeline_clear", False)),
        "witnesses_mentioned": bool(layer1.get("witnesses_mentioned", False)),
        "prior_reporting_mentioned": bool(layer1.get("prior_reporting_mentioned", False)),
        "impact_described": bool(layer1.get("impact_described", False)),
        "retaliation_mentioned": bool(layer1.get("retaliation_mentioned", False)),
        "allegation_type": list(layer1.get("allegation_type") or []),
        "length_character_count": int(layer1.get("length_character_count", 0)),
        "used_defaults": bool(layer1.get("_used_defaults", False)),
    }
    return out


def build_extraction_breakdown(
    layer1_raw: Layer1Result,
    form_data: dict | None,
) -> dict[str, Any]:
    """Algorithmic (form) vs model (raw Layer-1) slices for API and UI."""
    return {
        "from_answers": algorithmic_from_form(form_data),
        "from_model": layer1_to_public_model_slice(layer1_raw),
    }
