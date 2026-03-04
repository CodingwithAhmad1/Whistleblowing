"""FastAPI app with LLM-powered chat and report generation."""

from pathlib import Path
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .llm import get_provider
from .routers import chat, questions, admin
from .config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initialize provider on startup, cleanup on shutdown."""
    logger.info("Starting application...")
    provider = get_provider()
    await provider.initialize()
    yield
    logger.info("Shutting down application...")
    await provider.cleanup()


app = FastAPI(
    title="ReportIQ Whistleblowing API",
    description="LLM-powered whistleblowing report assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(questions.router, prefix="/api", tags=["questions"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


@app.get("/api/health")
def health():
    """Health check endpoint."""
    provider = get_provider()
    return {
        "status": "ok",
        "provider": settings.LLM_PROVIDER,
        "ready": provider is not None,
    }


# Path to frontend dist (built React app)
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

# SPA catch-all for production
if FRONTEND_DIST.exists():
    _dist_root = FRONTEND_DIST.resolve()
    _dist_files: frozenset[str] = frozenset(
        str(p) for p in _dist_root.rglob("*") if p.is_file()
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        file_path = str((_dist_root / full_path).resolve())
        if file_path in _dist_files:
            return FileResponse(file_path)
        return FileResponse(str(_dist_root / "index.html"))
