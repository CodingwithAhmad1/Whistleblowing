"""Prompt format abstraction - Gemini plain-text format."""

import logging

logger = logging.getLogger(__name__)


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def _truncate_history(
    conversation_history: list[dict[str, str]],
    max_history: int = 20,
    max_context: int = 8192,
    system_tokens: int = 0,
    reserved_for_response: int = 512,
) -> list[dict[str, str]]:
    """Truncate history to fit token budget."""
    available = max_context - system_tokens - reserved_for_response - 100
    recent = []
    history_tokens = 0
    for msg in reversed(conversation_history):
        msg_tokens = _estimate_tokens(msg["content"]) + 20
        if history_tokens + msg_tokens > available:
            break
        recent.insert(0, msg)
        history_tokens += msg_tokens
        if len(recent) >= max_history:
            break
    return recent


def format_for_provider(
    system_prompt: str,
    conversation_history: list[dict[str, str]],
    provider_name: str | None = None,
) -> str:
    """
    Format prompt for Gemini (plain text: System/User/Assistant).
    provider_name is ignored; kept for API compatibility.
    """
    recent = _truncate_history(
        conversation_history,
        max_context=8192,
        system_tokens=_estimate_tokens(system_prompt),
    )
    parts = [f"System: {system_prompt}\n\n"]
    for msg in recent:
        role = msg["role"].capitalize()
        parts.append(f"{role}: {msg['content']}\n\n")
    parts.append("Assistant: ")
    return "".join(parts)
