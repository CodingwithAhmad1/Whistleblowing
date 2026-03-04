"""Response types for two-layer workflow. Extend this list as needed."""

RESPONSE_TYPES = [
    "irrelevant",        # User off-topic -> redirect politely
    "extract_data",      # Report-relevant info -> extract JSON, ask next
    "clarification",     # Ambiguous -> ask follow-up
    "complete",         # Report done -> thank and confirm
    "sensitive_support", # Emotional/distressed -> brief support, then continue
]

DEFAULT_TYPE = "extract_data"

_RESPONSE_TYPE_SET = set(RESPONSE_TYPES)


def normalize_response_type(raw: str) -> str:
    """Parse and normalize classifier output to a valid response type."""
    if not raw or not isinstance(raw, str):
        return DEFAULT_TYPE
    normalized = raw.strip().lower().replace(" ", "_").replace("-", "_")
    if normalized in _RESPONSE_TYPE_SET:
        return normalized
    return DEFAULT_TYPE
