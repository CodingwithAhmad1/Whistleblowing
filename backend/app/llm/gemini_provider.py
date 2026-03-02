"""Gemini LLM provider via Google Generative AI SDK."""

import asyncio
import logging
from queue import Queue
from typing import AsyncGenerator

from ..config import settings

logger = logging.getLogger(__name__)


class GeminiProvider:
    """Gemini 1.5 Flash provider for chat completions."""

    def __init__(self):
        self._model = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Initialize Gemini client and model."""
        import google.generativeai as genai

        logger.info("Initializing Gemini Provider...")
        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip():
            raise ValueError("GEMINI_API_KEY is required for Gemini provider")
        genai.configure(api_key=api_key.strip())
        self._model = genai.GenerativeModel(settings.GEMINI_MODEL)
        logger.info(f"Gemini provider ready (model: {settings.GEMINI_MODEL})")

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from Gemini."""
        if not self._model:
            raise RuntimeError("Gemini not initialized. Call initialize() first.")
        max_tokens = max_tokens or settings.MAX_TOKENS
        async with self._lock:
            logger.debug(f"Generating via Gemini (prompt length: {len(prompt)})")
            thread_queue: Queue[str | None] = Queue()

            def _stream_thread():
                try:
                    response = self._model.generate_content(
                        prompt,
                        generation_config={
                            "max_output_tokens": max_tokens,
                            "temperature": settings.TEMPERATURE,
                            "top_p": settings.TOP_P,
                        },
                        stream=True,
                    )
                    for chunk in response:
                        if chunk.text:
                            thread_queue.put(chunk.text)
                finally:
                    thread_queue.put(None)

            loop = asyncio.get_event_loop()
            loop.run_in_executor(None, _stream_thread)

            while True:
                token = await loop.run_in_executor(
                    None,
                    lambda: thread_queue.get(timeout=60),
                )
                if token is None:
                    break
                yield token
                await asyncio.sleep(0.001)

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self._model:
            logger.info("Cleaning up Gemini provider...")
            self._model = None
            self._client = None
