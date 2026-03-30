"""Shared pytest fixtures for integration tests."""

import asyncio
import pytest

from app.llm import get_provider


@pytest.fixture(scope="session", autouse=True)
def initialize_gemini():
    """Initialize the Gemini provider once before any tests run."""
    provider = get_provider()
    asyncio.run(provider.initialize())
