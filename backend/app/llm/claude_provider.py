"""Anthropic Claude LLM provider."""

import asyncio
import logging
import re
from typing import AsyncGenerator

from ..config import settings

logger = logging.getLogger(__name__)


def _parse_flat_prompt(prompt: str) -> tuple[str, list[dict]]:
    """
    Parse the flat-string prompt format into system + messages list.
    Input format: "System: <sys>\n\nUser: <msg>\n\nAssistant: <msg>\n\nAssistant: "
    """
    # Strip trailing "Assistant: " marker
    prompt = re.sub(r'\n*Assistant:\s*$', '', prompt).rstrip()

    # Split system from conversation
    system = ""
    if prompt.startswith("System:"):
        parts = prompt.split("\n\n", 1)
        system = parts[0].replace("System:", "", 1).strip()
        prompt = parts[1] if len(parts) > 1 else ""

    # Parse turns
    messages = []
    # Split on role markers
    turns = re.split(r'\n\n(User|Assistant):', prompt)
    # turns[0] is empty or preamble, then alternating [role, content, role, content...]
    i = 1
    while i < len(turns) - 1:
        role = turns[i].strip().lower()
        content = turns[i + 1].strip()
        if content:
            messages.append({"role": role, "content": content})
        i += 2

    # Ensure we start with a user message
    if not messages or messages[0]["role"] != "user":
        messages.insert(0, {"role": "user", "content": "Hello"})

    # Ensure last message is from user (Claude API requires this for generation)
    if messages and messages[-1]["role"] == "assistant":
        messages = messages[:-1]

    return system, messages


class ClaudeProvider:
    """Claude provider using the Anthropic SDK."""

    def __init__(self):
        self._client = None

    async def initialize(self) -> None:
        """Initialize Anthropic client."""
        import anthropic

        logger.info("Initializing Claude Provider...")
        api_key = settings.ANTHROPIC_API_KEY
        if not api_key or not api_key.strip():
            raise ValueError("ANTHROPIC_API_KEY is required for Claude provider")
        self._client = anthropic.Anthropic(api_key=api_key.strip())
        logger.info(f"Claude provider ready (model: {settings.CLAUDE_MODEL})")

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from Claude."""
        if not self._client:
            raise RuntimeError("Claude not initialized. Call initialize() first.")

        max_tokens = max_tokens or settings.MAX_TOKENS
        logger.debug(f"Generating via Claude (prompt length: {len(prompt)})")

        system, messages = _parse_flat_prompt(prompt)
        loop = asyncio.get_event_loop()

        def _collect_stream():
            chunks = []
            kwargs = dict(
                model=settings.CLAUDE_MODEL,
                max_tokens=max_tokens,
                messages=messages,
                temperature=settings.TEMPERATURE,
            )
            if system:
                kwargs["system"] = system
            with self._client.messages.stream(**kwargs) as stream:
                for text in stream.text_stream:
                    chunks.append(text)
            return chunks

        chunks = await loop.run_in_executor(None, _collect_stream)
        for chunk in chunks:
            yield chunk
            await asyncio.sleep(0.001)

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._client:
            logger.info("Cleaning up Claude provider...")
            self._client = None
