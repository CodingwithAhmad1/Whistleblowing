"""Prompt format abstraction - different chat formats per provider."""

from typing import Dict
import logging

from ..config import settings

logger = logging.getLogger(__name__)


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def _truncate_history(
    conversation_history: list[Dict[str, str]],
    max_history: int = 20,
    max_context: int = 8192,
    system_tokens: int = 0,
    reserved_for_response: int = 512,
) -> list[Dict[str, str]]:
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
    conversation_history: list[Dict[str, str]],
    provider_name: str | None = None,
) -> str:
    """
    Format prompt for the active provider.
    - gemini: Plain text format (system + user/assistant turns)
    - ollama / local: ChatML format for Phi/Ollama
    """
    provider = provider_name or settings.LLM_PROVIDER
    recent = _truncate_history(
        conversation_history,
        max_context=8192 if provider == "gemini" else 2048,
        system_tokens=_estimate_tokens(system_prompt),
    )

    if provider == "gemini":
        parts = [f"System: {system_prompt}\n\n"]
        for msg in recent:
            role = msg["role"].capitalize()
            parts.append(f"{role}: {msg['content']}\n\n")
        parts.append("Assistant: ")
        return "".join(parts)

    # ChatML for ollama / local
    prompt = f"<|system|>\n{system_prompt}<|end|>\n"
    for msg in recent:
        role = msg["role"]
        content = msg["content"]
        if role == "user":
            prompt += f"<|user|>\n{content}<|end|>\n"
        elif role == "assistant":
            prompt += f"<|assistant|>\n{content}<|end|>\n"
    prompt += "<|assistant|>\n"
    return prompt
