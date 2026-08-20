"""Dual-corpus coverage classification (spec Component B extension).

For each account, both corpora are queried independently and the best matches
compared against per-corpus thresholds τ:

    covered      policy ≥ τp                 firm policy addresses this
    legal_only   legal ≥ τl, policy < τp     POLICY GAP — law covers it, firm's rules don't
    policy_only  policy ≥ τp, legal < τl     firm exceeds statutory floor
    uncovered    both < τ                    neither addresses it — potential novel conduct

`legal_only` and `uncovered` feed Component C (amendment proposals).

τ applies to the dense cosine similarity of the top reranker-surviving
candidate; both the similarity and the LLM relevance score are recorded so
calibration (scripts/eval_retrieval.py) can revisit the operating point.

Copy rule: absence of a match is NEVER rendered as "no violation occurred" —
absence text attributes silence to the index, not the conduct.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from pydantic import BaseModel, model_validator

from ..config import settings
from .service import get_retrieval_service
from .verbatim import is_verbatim

logger = logging.getLogger(__name__)

CoverageClass = Literal["covered", "legal_only", "policy_only", "uncovered"]

CORPUS_DISPLAY_NAMES = {"policy": "firm policy", "legal": "legal"}

ABSENCE_NOTICE_TEMPLATE = (
    "No matching provision was found in the indexed {name} corpus. "
    "This reflects the coverage of the index, not an assessment of the reported conduct."
)


class PinnedExcerpt(BaseModel):
    """A verbatim excerpt with a pinned reference (spec retrieval contract).

    `verbatim_text` is enforced at this serialization layer: when a canonical
    document text is available for the char span, the excerpt must match it.
    `interpretation` is the only model-authored field and is rendered separately.
    """

    corpus: str
    document_id: Optional[str] = None
    section: Optional[str] = None
    char_span: Optional[tuple[int, int]] = None
    verbatim_text: str
    score: float
    relevance_score: Optional[int] = None
    interpretation: Optional[str] = None

    @model_validator(mode="after")
    def _enforce_verbatim(self) -> "PinnedExcerpt":
        if self.char_span and self.document_id:
            canonical = _load_canonical_text(self.corpus, self.document_id)
            if canonical is not None:
                start, end = self.char_span
                slice_ = canonical[start:end]
                if not is_verbatim(self.verbatim_text, slice_) and not is_verbatim(
                    slice_, self.verbatim_text
                ):
                    raise ValueError(
                        f"verbatim_text does not match canonical span {self.char_span} "
                        f"of {self.corpus}/{self.document_id}"
                    )
        return self


class CoverageResult(BaseModel):
    classification: CoverageClass
    policy: Optional[PinnedExcerpt] = None
    legal: Optional[PinnedExcerpt] = None
    scores: dict[str, Optional[float]]
    thresholds: dict[str, float]
    absence_notices: list[str]


_canonical_cache: dict[tuple[str, str], str | None] = {}


def _load_canonical_text(corpus: str, document_id: str) -> str | None:
    key = (corpus, document_id)
    if key not in _canonical_cache:
        from pathlib import Path

        path = (
            Path(__file__).resolve().parent.parent.parent
            / "data" / "corpus_text" / corpus / f"{document_id}.txt"
        )
        try:
            _canonical_cache[key] = path.read_text(encoding="utf-8")
        except OSError:
            logger.warning("Canonical text missing for %s/%s (%s)", corpus, document_id, path)
            _canonical_cache[key] = None
    return _canonical_cache[key]


def _excerpt_from_result(corpus: str, result: dict[str, Any]) -> PinnedExcerpt | None:
    try:
        return PinnedExcerpt(
            corpus=corpus,
            document_id=result.get("document_id"),
            section=result.get("section"),
            char_span=tuple(result["char_span"]) if result.get("char_span") else None,
            verbatim_text=result["quote"],
            score=float(result.get("similarity") or 0.0),
            relevance_score=result.get("relevance_score"),
            interpretation=result.get("interpretation"),
        )
    except ValueError as e:
        # Serialization-layer enforcement tripped: never surface the excerpt.
        logger.error("PinnedExcerpt rejected for %s: %s", corpus, e)
        return None


def classify_coverage(query_text: str) -> CoverageResult:
    """Query both corpora and classify coverage of the described conduct."""
    tau = {"policy": settings.RAG_TAU_POLICY, "legal": settings.RAG_TAU_LEGAL}

    excerpts: dict[str, PinnedExcerpt | None] = {}
    scores: dict[str, float | None] = {}
    for corpus in ("policy", "legal"):
        result = get_retrieval_service(corpus).query(query_text)
        excerpt = _excerpt_from_result(corpus, result) if result else None
        excerpts[corpus] = excerpt
        scores[corpus] = excerpt.score if excerpt else None

    policy_hit = scores["policy"] is not None and scores["policy"] >= tau["policy"]
    legal_hit = scores["legal"] is not None and scores["legal"] >= tau["legal"]

    if policy_hit and legal_hit:
        classification: CoverageClass = "covered"
    elif policy_hit:
        classification = "policy_only"
    elif legal_hit:
        classification = "legal_only"
    else:
        classification = "uncovered"

    absence_notices = [
        ABSENCE_NOTICE_TEMPLATE.format(name=CORPUS_DISPLAY_NAMES[c])
        for c in ("policy", "legal")
        if not (policy_hit if c == "policy" else legal_hit)
    ]

    logger.info(
        "Coverage: %s (policy=%.3f%s, legal=%.3f%s, τ=%.2f/%.2f)",
        classification,
        scores["policy"] or 0.0, "*" if policy_hit else "",
        scores["legal"] or 0.0, "*" if legal_hit else "",
        tau["policy"], tau["legal"],
    )

    return CoverageResult(
        classification=classification,
        policy=excerpts["policy"],
        legal=excerpts["legal"],
        scores=scores,
        thresholds=tau,
        absence_notices=absence_notices,
    )
