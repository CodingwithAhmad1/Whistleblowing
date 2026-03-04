"""Registry mapping question keys to processor instances."""

from typing import Literal

from .base import QuestionProcessor
from .q2_processor import Q2Processor
from .q3_processor import Q3Processor

_processors: dict[str, QuestionProcessor] = {
    "q2": Q2Processor(),
    "q3": Q3Processor(),
}


def get_processor(key: Literal["q2", "q3"]) -> QuestionProcessor:
    """Get the processor for the given question key."""
    proc = _processors.get(key)
    if not proc:
        raise ValueError(f"Unknown question key: {key}")
    return proc


def register_processor(key: str, processor: QuestionProcessor) -> None:
    """Register a processor. Use to swap implementations at runtime."""
    _processors[key] = processor
