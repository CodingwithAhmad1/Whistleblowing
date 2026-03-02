"""Layer 2: Execution prompts per response type."""

from typing import Dict, Any

from .core import build_system_prompt, REPORT_FIELDS
from .formats import format_for_provider
from .policy_quoting import get_relevant_policy_snippets
from ..config import settings


def build_execution_prompt(
    response_type: str,
    report_data: Dict[str, Any],
    conversation_history: list[Dict[str, str]],
    user_message: str,
    provider_name: str | None = None,
) -> str:
    """
    Build the Layer 2 execution prompt based on classified response type.
    For extract_data, uses full report system prompt. For others, uses focused templates.
    """
    provider = provider_name or settings.LLM_PROVIDER

    if response_type == "extract_data":
        system = build_system_prompt(report_data)
        policy_snippets = get_relevant_policy_snippets(user_message)
        if policy_snippets:
            system += f"\n\nRelevant policy context (quote if helpful):\n" + "\n".join(f"- {s}" for s in policy_snippets)
        return format_for_provider(system, conversation_history, provider)

    # Lightweight prompts for non-extract types
    unfilled = [f for f in REPORT_FIELDS if not (report_data.get(f["key"]) and str(report_data.get(f["key"], "")).strip())]
    unfilled_keys = ", ".join([f["key"] for f in unfilled[:5]]) or "none"

    if response_type == "irrelevant":
        system = f"""You are a whistleblowing report assistant. The user went off-topic.
Politely redirect in 1 sentence. Then ask the next report question.
Unfilled fields to prioritize: {unfilled_keys}
Be concise. One short redirect + one question. No preamble."""
    elif response_type == "clarification":
        system = f"""You are a whistleblowing report assistant. The user's answer was ambiguous.
Ask one brief clarifying question. Be concise. Stay on report topic.
Unfilled fields: {unfilled_keys}"""
    elif response_type == "complete":
        system = """You are a whistleblowing report assistant. All report fields are filled.
Thank the user warmly. Confirm the report is ready. Offer to help with anything else.
Keep it to 2-3 short sentences."""
    elif response_type == "sensitive_support":
        system = f"""You are a supportive whistleblowing report assistant. The user seems distressed.
Offer brief empathy (1 sentence). Then gently ask the next report question.
Unfilled fields: {unfilled_keys}
Be warm but concise."""
    else:
        system = build_system_prompt(report_data)
        return format_for_provider(system, conversation_history, provider)

    return format_for_provider(system, conversation_history, provider)
