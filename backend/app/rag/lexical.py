"""BM25 lexical index over a corpus's chunks, for the hybrid retrieval leg.

Legal/policy language is highly lexical ("bribery", "insider trading",
"retaliation") — a keyword leg catches exact-term matches that pure dense
retrieval over a small corpus can miss. Fused with dense ranks via RRF in
service.py.
"""

from __future__ import annotations

import logging
import re

from rank_bm25 import BM25Okapi

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class LexicalIndex:
    """In-memory BM25 index over chunk ids/texts (corpora are small: <500 chunks)."""

    def __init__(self, ids: list[str], texts: list[str]):
        self._ids = ids
        self._bm25 = BM25Okapi([tokenize(t) for t in texts]) if texts else None

    def rank(self, query: str, top_n: int) -> list[str]:
        """Return chunk ids ranked by BM25 score (only ids with score > 0)."""
        if self._bm25 is None:
            return []
        tokens = tokenize(query)
        if not tokens:
            return []
        scores = self._bm25.get_scores(tokens)
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return [self._ids[i] for i in order[:top_n] if scores[i] > 0]
