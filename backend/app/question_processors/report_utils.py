"""Shared helpers for extracting report context for question processors."""

from typing import Any

# Keys used by Q2 and Q3 for incident context (order matters for display)
INCIDENT_CONTEXT_KEYS = ["full_details_q1", "general_nature", "where_occurred", "when_occurred"]

# Subset used for Q3 retrieval query (no when_occurred)
INCIDENT_QUERY_KEYS = ["full_details_q1", "general_nature", "where_occurred"]

# Labels for Q2 prompt (aligned with INCIDENT_CONTEXT_KEYS)
INCIDENT_LABELS = {
    "full_details_q1": "User description",
    "general_nature": "General nature",
    "where_occurred": "Where",
    "when_occurred": "When",
}


def has_value(val: Any) -> bool:
    """Return True if value is present and has non-empty stripped string content."""
    if val is None:
        return False
    return bool(str(val).strip())


def _non_empty(val: Any) -> str | None:
    """Return stripped string if value is present and non-empty, else None."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def extract_incident_parts(report_data: dict[str, Any]) -> list[str]:
    """
    Extract incident fields as labeled lines for prompt context.
    Returns e.g. ["User description: ...", "General nature: ..."]
    """
    parts = []
    for key in INCIDENT_CONTEXT_KEYS:
        s = _non_empty(report_data.get(key))
        if s:
            label = INCIDENT_LABELS.get(key, key)
            parts.append(f"{label}: {s}")
    return parts


def first_line(text: str) -> str:
    """Return the first line from text (stripped). Used to normalize LLM stream output."""
    return (text or "").strip().split("\n")[0]


def truncate_to_words(text: str, max_words: int) -> str:
    """Truncate to max_words. Returns empty string if text is empty after strip."""
    s = (text or "").strip()
    if not s:
        return ""
    words = s.split()
    return " ".join(words[:max_words]) if len(words) > max_words else s


def get_stored_prompt_template(setting_key: str, default: str) -> str:
    """Return stored template from settings or default if empty. Single source for Q2/Q3 templates."""
    from ..settings import get_settings
    stored = get_settings().get(setting_key) or ""
    return stored.strip() or default


def extract_incident_query(report_data: dict[str, Any]) -> str:
    """
    Extract incident fields as a space-joined query string for retrieval.
    Uses INCIDENT_QUERY_KEYS (Q3-style: full_details_q1, general_nature, where_occurred).
    """
    parts = []
    for key in INCIDENT_QUERY_KEYS:
        s = _non_empty(report_data.get(key))
        if s:
            parts.append(s)
    return " ".join(parts) if parts else "whistleblowing policy"
