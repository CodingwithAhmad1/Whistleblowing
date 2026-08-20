"""Backend configuration settings."""

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Gemini (required)
    GEMINI_API_KEY: Optional[str] = None
    # Default matches the head of model_fallback.MODEL_CHAIN.
    GEMINI_MODEL: str = "gemini-3.6-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Inference settings
    TEMPERATURE: float = 0.7
    # Layer-1 intake JSON uses stricter decoding; lower variance than chat/Q2/Q3.
    INTAKE_TEMPERATURE: float = 0.2
    TOP_P: float = 0.9
    MAX_TOKENS: int = 512

    # RAG retrieval (thresholds are evaluation parameters; see scripts/eval_retrieval.py)
    RAG_MIN_SIMILARITY: float = 0.3
    RAG_MIN_RELEVANCE_SCORE: int = 3
    RAG_N_RESULTS: int = 8
    # Embedding dimensionality must match the ingested index; guarded at collection open.
    EMBEDDING_DIMENSIONS: int = 3072

    # Hybrid retrieval: dense + BM25 fused via reciprocal rank fusion.
    RAG_HYBRID_ENABLED: bool = True
    RAG_RRF_K: int = 60

    # Coverage classification thresholds (τ per corpus) applied to the dense
    # similarity of the top reranker-surviving candidate. Calibrated 2026-08-20
    # via scripts/eval_retrieval.py over 14 labelled vignettes (71% accuracy at
    # this operating point; dump in data/eval/). Small n — re-sweep as the
    # vignette set grows; a similarity+relevance blended gate is the follow-up.
    RAG_TAU_POLICY: float = 0.65
    RAG_TAU_LEGAL: float = 0.60

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
