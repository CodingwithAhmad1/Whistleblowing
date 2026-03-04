"""Helpers for consuming LLM stream output."""

from .base import LLMProvider


async def collect_stream(
    provider: LLMProvider,
    prompt: str,
    max_tokens: int | None = None,
) -> str:
    """
    Consume a full stream from the provider and return the concatenated text.
    Use when you need the complete response (e.g. classification, Q2 generation).
    """
    chunks: list[str] = []
    async for token in provider.generate_stream(prompt, max_tokens=max_tokens):
        chunks.append(token)
    return "".join(chunks).strip()
