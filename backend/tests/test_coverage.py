"""Tests for dual-corpus coverage classification and the pinned-excerpt contract."""

from unittest.mock import patch

import pytest

from app.config import settings
from app.rag.coverage import (
    ABSENCE_NOTICE_TEMPLATE,
    PinnedExcerpt,
    classify_coverage,
)


def _result(similarity: float, corpus: str) -> dict:
    return {
        "quote": f"verbatim text from {corpus}",
        "section": "Some Section",
        "similarity": similarity,
        "relevance_score": 4,
        "corpus": corpus,
        "document_id": f"{corpus}_doc",
        "char_span": None,  # no canonical text in unit tests → validator is a no-op
        "interpretation": "model note",
    }


def _classify_with(policy_sim: float | None, legal_sim: float | None):
    def fake_get_service(corpus):
        class _Svc:
            def query(self, _q):
                sim = policy_sim if corpus == "policy" else legal_sim
                return _result(sim, corpus) if sim is not None else None

        return _Svc()

    with patch("app.rag.coverage.get_retrieval_service", side_effect=fake_get_service):
        return classify_coverage("test query")


@pytest.fixture(autouse=True)
def fixed_tau(monkeypatch):
    monkeypatch.setattr(settings, "RAG_TAU_POLICY", 0.5)
    monkeypatch.setattr(settings, "RAG_TAU_LEGAL", 0.5)


# ── Truth table (spec Component B) ───────────────────────────────────────────


def test_covered_when_both_above_tau():
    r = _classify_with(0.7, 0.6)
    assert r.classification == "covered"
    assert not r.absence_notices


def test_legal_only_is_a_policy_gap():
    r = _classify_with(0.3, 0.7)
    assert r.classification == "legal_only"
    assert r.legal is not None and r.legal.corpus == "legal"


def test_policy_only_when_firm_exceeds_statutory_floor():
    r = _classify_with(0.7, 0.2)
    assert r.classification == "policy_only"


def test_uncovered_when_both_below_tau():
    r = _classify_with(0.2, 0.2)
    assert r.classification == "uncovered"
    assert len(r.absence_notices) == 2


def test_no_match_treated_as_below_tau():
    r = _classify_with(None, 0.8)
    assert r.classification == "legal_only"
    assert r.scores["policy"] is None
    assert r.policy is None


def test_boundary_exactly_tau_counts_as_hit():
    r = _classify_with(0.5, 0.49999)
    assert r.classification == "policy_only"


# ── Absence copy: silence attributed to the index, never the conduct ─────────


def test_absence_notice_wording():
    r = _classify_with(0.2, 0.7)
    assert len(r.absence_notices) == 1
    notice = r.absence_notices[0]
    assert notice == ABSENCE_NOTICE_TEMPLATE.format(name="firm policy")
    assert "not an assessment of the reported conduct" in notice
    assert "no violation" not in notice.lower()


# ── PinnedExcerpt serialization-layer enforcement ────────────────────────────


def test_pinned_excerpt_rejects_text_not_matching_canonical_span(tmp_path, monkeypatch):
    import app.rag.coverage as coverage_mod

    canonical = "Alpha beta gamma delta epsilon."
    doc_dir = tmp_path / "corpus_text" / "policy"
    doc_dir.mkdir(parents=True)
    (doc_dir / "doc1.txt").write_text(canonical, encoding="utf-8")

    monkeypatch.setattr(
        coverage_mod,
        "_load_canonical_text",
        lambda corpus, doc_id: canonical,
    )
    coverage_mod._canonical_cache.clear()

    # Matching span: OK
    PinnedExcerpt(
        corpus="policy",
        document_id="doc1",
        char_span=(6, 16),
        verbatim_text="beta gamma",
        score=0.8,
    )

    # Tampered text for the same span: rejected at instantiation
    with pytest.raises(ValueError):
        PinnedExcerpt(
            corpus="policy",
            document_id="doc1",
            char_span=(6, 16),
            verbatim_text="fabricated words",
            score=0.8,
        )


def test_pinned_excerpt_without_span_is_accepted():
    e = PinnedExcerpt(corpus="legal", verbatim_text="anything", score=0.5)
    assert e.char_span is None


# ── Interpretation stays a separate field ────────────────────────────────────


def test_interpretation_never_merged_into_verbatim():
    r = _classify_with(0.7, 0.7)
    assert r.policy.interpretation == "model note"
    assert "model note" not in r.policy.verbatim_text
