"""Local Phi model via llama-cpp-python."""

import asyncio
from pathlib import Path
from typing import AsyncGenerator, Optional
import logging

from ..config import settings

logger = logging.getLogger(__name__)


class LocalPhiProvider:
    """Manages Phi model lifecycle via llama-cpp with efficient resource usage."""

    def __init__(self):
        self.model = None
        self._lock = asyncio.Lock()
        self._model_path: Optional[Path] = None

    async def initialize(self) -> None:
        """Download and load model on startup."""
        from llama_cpp import Llama
        from huggingface_hub import hf_hub_download

        logger.info("Initializing Local Phi Provider...")
        settings.MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._model_path = await self._ensure_model_downloaded(hf_hub_download)
        logger.info(f"Loading model from {self._model_path}")
        self.model = Llama(
            model_path=str(self._model_path),
            n_ctx=settings.N_CTX,
            n_batch=settings.N_BATCH,
            n_threads=settings.N_THREADS,
            n_gpu_layers=settings.N_GPU_LAYERS,
            verbose=False,
        )
        logger.info("Local Phi model loaded successfully!")

    async def _ensure_model_downloaded(self, hf_hub_download) -> Path:
        model_path = settings.MODEL_CACHE_DIR / settings.MODEL_FILE
        if model_path.exists():
            logger.info(f"Model already cached at {model_path}")
            return model_path
        logger.info(f"Downloading model {settings.MODEL_NAME}/{settings.MODEL_FILE}...")
        loop = asyncio.get_event_loop()
        downloaded_path = await loop.run_in_executor(
            None,
            hf_hub_download,
            settings.MODEL_NAME,
            settings.MODEL_FILE,
            str(settings.MODEL_CACHE_DIR),
        )
        return Path(downloaded_path)

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[str, None]:
        """Generate streaming response from model."""
        if not self.model:
            raise RuntimeError("Local Phi not initialized. Call initialize() first.")
        max_tokens = max_tokens or settings.MAX_TOKENS
        async with self._lock:
            logger.debug(f"Generating response for prompt (length: {len(prompt)})")
            loop = asyncio.get_event_loop()

            def _generate():
                return self.model(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=settings.TEMPERATURE,
                    top_p=settings.TOP_P,
                    repeat_penalty=settings.REPEAT_PENALTY,
                    stream=True,
                )

            stream = await loop.run_in_executor(None, _generate)
            for chunk in stream:
                if "choices" in chunk and len(chunk["choices"]) > 0:
                    delta = chunk["choices"][0].get("text", "")
                    if delta:
                        yield delta
                        await asyncio.sleep(0.001)

    async def cleanup(self) -> None:
        """Cleanup resources."""
        if self.model:
            logger.info("Cleaning up Local Phi resources...")
            self.model = None
