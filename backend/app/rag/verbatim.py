"""Verbatim-quote enforcement.

The spec requires that every surfaced excerpt be verbatim-with-reference, enforced
at the serialization layer rather than in prompts. These helpers verify that an
LLM-returned quote is a contiguous substring of its source chunk, tolerating
whitespace and typographic-quote differences introduced by PDF extraction.
"""

import re

_WS_RE = re.compile(r"\s+")

# Typographic characters that LLMs commonly normalize when echoing text.
_CHAR_MAP = str.maketrans({
    "‘": "'",  # left single quote
    "’": "'",  # right single quote
    "“": '"',  # left double quote
    "”": '"',  # right double quote
    "–": "-",  # en dash
    "—": "-",  # em dash
    " ": " ",  # nbsp
})


def normalize(text: str) -> str:
    """Normalize whitespace and typographic characters for comparison."""
    return _WS_RE.sub(" ", text.translate(_CHAR_MAP)).strip()


def is_verbatim(quote: str, source: str) -> bool:
    """True if `quote` is a contiguous (normalized) substring of `source`."""
    if not quote or not source:
        return False
    return normalize(quote).lower() in normalize(source).lower()


def find_verbatim_span(quote: str, source: str) -> tuple[int, int] | None:
    """Locate `quote` in `source`, returning (start, end) offsets into the
    ORIGINAL source string, or None if the quote is not verbatim.

    Matching is done on normalized text; offsets are mapped back to the raw
    source via a position map built during normalization.
    """
    if not quote or not source:
        return None

    norm_quote = normalize(quote).lower()
    if not norm_quote:
        return None

    # Build normalized source alongside a map: normalized index -> source index.
    translated = source.translate(_CHAR_MAP)
    norm_chars: list[str] = []
    positions: list[int] = []
    prev_space = True  # leading whitespace is stripped
    for i, ch in enumerate(translated):
        if ch.isspace():
            if prev_space:
                continue
            norm_chars.append(" ")
            positions.append(i)
            prev_space = True
        else:
            norm_chars.append(ch.lower())
            positions.append(i)
            prev_space = False
    # Strip trailing space
    while norm_chars and norm_chars[-1] == " ":
        norm_chars.pop()
        positions.pop()

    norm_source = "".join(norm_chars)
    idx = norm_source.find(norm_quote)
    if idx == -1:
        return None

    start = positions[idx]
    end_norm = idx + len(norm_quote) - 1
    end = positions[end_norm] + 1
    return (start, end)
