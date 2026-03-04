"""Gemini LLM provider via Google Gen AI SDK."""

import logging
from typing import AsyncGenerator

from ..config import settings

logger = logging.getLogger(__name__)


class GeminiProvider:
    """Gemini provider for chat completions."""

    def __init__(self):
        self._ready = False

    async def initialize(self) -> None:
        """Validate API key and warm up client."""
        from .genai_config import ensure_genai_configured
        logger.info("Initializing Gemini Provider...")
        ensure_genai_configured()
        self._ready = True
        logger.info(f"Gemini provider ready (model: {settings.GEMINI_MODEL})")

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from Gemini with automatic quota fallback."""
        if not self._ready:
            raise RuntimeError("Gemini not initialized. Call initialize() first.")

        from .genai_config import get_client
        from .model_fallback import get_active_model
        from .usage_tracker import get_tracker
        from google.genai import types
        from google.genai.errors import ClientError

        client = get_client()
        tracker = get_tracker()
        max_tokens = max_tokens or settings.MAX_TOKENS

        tried: set[str] = set()

        while True:
            model = get_active_model()
            if model in tried:
                raise RuntimeError(
                    f"All Gemini models quota-exhausted. Tried: {tried}"
                )
            tried.add(model)

            input_tokens = len(prompt) // 4
            output_tokens = 0
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
                        output_tokens += len(chunk.text) // 4
                        yield chunk.text
            except ClientError as e:
                if e.code == 429:
                    logger.warning(
                        f"Quota 429 for model {model!r}, marking exhausted and retrying"
                    )
                    tracker.mark_exhausted(model)
                    quota_hit = True
                else:
                    raise

            if not quota_hit:
                tracker.record_usage(model, input_tokens, output_tokens)
                return
            # quota_hit=True: loop back and select next available model

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._ready:
            logger.info("Cleaning up Gemini provider...")
            self._ready = False
