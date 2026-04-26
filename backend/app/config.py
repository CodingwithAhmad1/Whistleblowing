"""Backend configuration settings."""

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Gemini (required)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Inference settings
    TEMPERATURE: float = 0.7
    # Layer-1 intake JSON uses stricter decoding; lower variance than chat/Q2/Q3.
    INTAKE_TEMPERATURE: float = 0.2
    TOP_P: float = 0.9
    MAX_TOKENS: int = 512

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS: include 127.0.0.1 and localhost; they are different origins for localStorage and must both hit the same API
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
