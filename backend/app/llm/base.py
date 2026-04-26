"""Abstract LLM provider interface."""

from typing import AsyncGenerator, Protocol


class LLMProvider(Protocol):
    """Protocol for LLM providers. All providers must implement these methods."""

    async def initialize(self) -> None:
        """Initialize the provider (load model, connect to API, etc.)."""
        ...

    async def cleanup(self) -> None:
        """Clean up resources."""
        ...

    async def generate_stream(
        self,
        prompt: str,
        max_tokens: int | None = None,
        *,
        temperature: float | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from the model. Yields string chunks.

        When ``temperature`` is None, the provider uses its default (usually ``TEMPERATURE``).
        """
        ...
