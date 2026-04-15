"""Gemini LLM provider via Google Gen AI SDK."""

import asyncio
import logging
from typing import AsyncGenerator

from ..config import settings

logger = logging.getLogger(__name__)


class GeminiProvider:
    """Gemini provider for chat completions."""

    def __init__(self):
        self._ready = False
        self._init_lock = asyncio.Lock()

    async def _ensure_ready(self) -> None:
        """Load GenAI client and API key once (thread-safe for concurrent streams)."""
        if self._ready:
            return
        async with self._init_lock:
            if self._ready:
                return
            from .genai_config import ensure_genai_configured
            ensure_genai_configured()
            self._ready = True

    async def initialize(self) -> None:
        """Validate API key and warm up client."""
        logger.info("Initializing Gemini Provider...")
        await self._ensure_ready()
        logger.info(f"Gemini provider ready (model: {settings.GEMINI_MODEL})")

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from Gemini with automatic quota fallback."""
        await self._ensure_ready()

        from .genai_config import get_client
        from .model_fallback import get_active_model, mark_model_exhausted
        from google.genai import types
        from google.genai.errors import ClientError

        client = get_client()
        max_tokens = max_tokens or settings.MAX_TOKENS

        tried: set[str] = set()

        while True:
            model = get_active_model()
            if model in tried:
                raise RuntimeError(
                    f"All Gemini models quota-exhausted. Tried: {tried}"
                )
            tried.add(model)

            quota_hit = False

            logger.debug(f"Generating via Gemini model={model!r} prompt_len={len(prompt)}")

            try:
                stream = await client.aio.models.generate_content_stream(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        max_output_tokens=max_tokens,
                        temperature=settings.TEMPERATURE,
                        top_p=settings.TOP_P,
                    ),
                )
                async for chunk in stream:
                    if chunk.text:
                        yield chunk.text
            except ClientError as e:
                if e.code == 429:
                    logger.warning(
                        f"Quota 429 for model {model!r}, marking exhausted and retrying"
                    )
                    mark_model_exhausted(model)
                    quota_hit = True
                else:
                    raise

            if not quota_hit:
                return
            # quota_hit=True: loop back and select next available model

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._ready:
            logger.info("Cleaning up Gemini provider...")
            self._ready = False
