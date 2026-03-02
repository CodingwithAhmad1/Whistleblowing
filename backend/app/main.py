"""FastAPI app with LLM-powered chat and report generation."""

from pathlib import Path
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .llm import get_provider
from .routers import chat
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

# Mount static files when dist exists (production)
if FRONTEND_DIST.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIST), html=True),
        name="static",
    )
