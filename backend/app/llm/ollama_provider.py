"""Ollama-compatible LLM provider for local Ollama instance."""

import asyncio
import json
import logging
from typing import AsyncGenerator, Optional

import aiohttp

from ..config import settings

logger = logging.getLogger(__name__)


class OllamaProvider:
    """Manages connection to local Ollama instance."""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self._lock = asyncio.Lock()
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.OLLAMA_MODEL

    async def initialize(self) -> None:
        """Initialize connection to Ollama."""
        logger.info("Initializing Ollama Provider...")
        self.session = aiohttp.ClientSession()
        try:
            await self._check_ollama_connection()
            await self._ensure_model_available()
            logger.info("Ollama connection established successfully!")
        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")
            raise

    async def _check_ollama_connection(self) -> None:
        if not self.session:
            raise RuntimeError("Session not initialized")
        async with self.session.get(f"{self.ollama_base_url}/api/tags") as response:
            if response.status != 200:
                raise RuntimeError(f"Ollama returned status {response.status}")
        logger.info("Ollama is running")

    async def _ensure_model_available(self) -> None:
        if not self.session:
            raise RuntimeError("Session not initialized")
        async with self.session.get(f"{self.ollama_base_url}/api/tags") as response:
            data = await response.json()
            models = [m["name"] for m in data.get("models", [])]
            if self.model_name not in models:
                raise RuntimeError(
                    f"Model '{self.model_name}' not found. Available: {models}. "
                    f"Run: ollama pull {self.model_name}"
                )
        logger.info(f"Model '{self.model_name}' is available")

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from Ollama."""
        if not self.session:
            raise RuntimeError("Ollama not initialized. Call initialize() first.")
        max_tokens = max_tokens or settings.MAX_TOKENS
        async with self._lock:
            logger.debug(f"Generating via Ollama (prompt length: {len(prompt)})")
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": settings.TEMPERATURE,
                    "top_p": settings.TOP_P,
                    "num_predict": max_tokens,
                    "repeat_penalty": settings.REPEAT_PENALTY,
                },
            }
            async with self.session.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise RuntimeError(f"Ollama API error: {error_text}")
                async for line in response.content:
                    if line:
                        try:
                            data = json.loads(line.decode("utf-8"))
                            if "response" in data:
                                yield data["response"]
                                await asyncio.sleep(0.001)
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self.session:
            logger.info("Closing Ollama session...")
            await self.session.close()
            self.session = None
