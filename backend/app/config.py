"""Backend configuration settings optimized for efficiency."""

from typing import Literal, Optional
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with efficient defaults for CPU/RAM."""

    # LLM provider: gemini | ollama | local
    LLM_PROVIDER: Literal["gemini", "ollama", "local"] = "gemini"

    # Gemini (required when LLM_PROVIDER=gemini)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "models/embedding-001"  # or "gemini-embedding-001" for newer API

    # Ollama (when LLM_PROVIDER=ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3.5"

    # Local Phi / llama-cpp (when LLM_PROVIDER=local)
    MODEL_NAME: str = "microsoft/Phi-3.5-mini-instruct-gguf"
    MODEL_FILE: str = "Phi-3.5-mini-instruct-q4.gguf"
    MODEL_CACHE_DIR: Path = Path(__file__).parent.parent / "models"
    N_CTX: int = 2048
    N_BATCH: int = 128
    N_THREADS: int = 4
    N_GPU_LAYERS: int = 0

    # Inference settings (shared)
    TEMPERATURE: float = 0.7
    TOP_P: float = 0.9
    MAX_TOKENS: int = 512
    REPEAT_PENALTY: float = 1.1

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
