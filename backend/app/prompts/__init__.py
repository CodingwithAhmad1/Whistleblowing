"""Prompt engineering for whistleblowing report assistant."""

from .core import (
    REPORT_FIELDS,
    build_system_prompt,
    build_chat_prompt,
)
from .formats import format_for_provider

__all__ = [
    "REPORT_FIELDS",
    "build_system_prompt",
    "build_chat_prompt",
    "format_for_provider",
]
