"""Base protocol for question processors."""

from typing import Protocol, TypedDict, Union


class Q2Output(TypedDict):
    """Output shape for Q2 processor."""

    content: str


class Q3Output(TypedDict):
    """Output shape for Q3 processor."""

    policyExcerpt: str
    question: str


QuestionOutput = Union[Q2Output, Q3Output]


class QuestionProcessor(Protocol):
    """Protocol for question processors. Each Q2/Q3 implementation must conform."""

    async def process(self, report_data: dict) -> QuestionOutput:
        """Process report data and return question-specific output."""
        ...

    def get_fallback(self) -> QuestionOutput:
        """Return fallback output when process fails or has no data."""
        ...
