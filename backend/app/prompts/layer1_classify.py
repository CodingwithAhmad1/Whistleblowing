"""Layer 1: Classify user message into response type."""

from typing import Any

from .core import get_filled_report_fields


def build_classify_prompt(
    user_message: str,
    report_data: dict[str, Any],
    last_messages: list[dict[str, str]],
) -> str:
    """
    Build a short prompt for response type classification.
    Keep minimal to reduce tokens. Max output ~20 tokens.
    """
    filled = get_filled_report_fields(report_data)
    all_filled = len(filled) > 40  # Rough: most report fields filled

    types_str = "irrelevant | extract_data | clarification | complete | sensitive_support"
    return f"""You are a classifier. Classify the user's message for a whistleblowing report assistant.
Reply with ONLY one word: {types_str}

Context: Gathering whistleblowing report. Report {'complete' if all_filled else 'in progress'}.
Last exchange (if any): {_format_recent(last_messages)}
User: {user_message}

Classification:"""


def _format_recent(messages: list[dict[str, str]], max_chars: int = 200) -> str:
    """Format last few messages for context."""
    if not messages:
        return "(none)"
    parts = []
    total = 0
    for m in reversed(messages[-4:]):
        s = f"{m['role']}: {m['content'][:80]}..."
        if total + len(s) > max_chars:
            break
        parts.insert(0, s)
        total += len(s)
    return " | ".join(parts) if parts else "(none)"
