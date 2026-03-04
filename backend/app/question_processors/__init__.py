"""Modular question processors for Full Details Q2 and Q3."""

from .base import QuestionProcessor, QuestionOutput
from .registry import get_processor
from .q2_processor import Q2Processor
from .q3_processor import Q3Processor

__all__ = [
    "QuestionProcessor",
    "QuestionOutput",
    "get_processor",
    "Q2Processor",
    "Q3Processor",
]
