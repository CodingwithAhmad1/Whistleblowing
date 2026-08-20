"""Shared pytest fixtures.

Unit tests (everything not marked `integration`) run fully mocked and must not
require a Gemini API key. Provider warmup is therefore best-effort: if it fails
(no key, no network), unit tests proceed and integration tests fail naturally
at their first live call.
"""

import asyncio
import logging

import pytest

from app.llm import get_provider

logger = logging.getLogger(__name__)


@pytest.fixture(scope="session", autouse=True)
def initialize_gemini():
    """Initialize the Gemini provider once before any tests run (best-effort)."""
    try:
        provider = get_provider()
        asyncio.run(provider.initialize())
    except Exception as e:
        logger.warning("Gemini provider init skipped (unit tests unaffected): %s", e)
