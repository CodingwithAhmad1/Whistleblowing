"""Tests for PolicyRAGService.query() with mocked ChromaDB + LLM (no network)."""

from unittest.mock import MagicMock, patch

from app.rag.service import PolicyRAGService, _raw_excerpt, strip_section_prefix


def _make_service(candidates_data, distances=None):
    service = PolicyRAGService()
    service._available = True
    mock_collection = MagicMock()
    mock_collection.count.return_value = len(candidates_data)
    mock_collection.query.return_value = {
        "ids": [[f"chunk_{i}" for i in range(len(candidates_data))]],
        "documents": [[c["text"] for c in candidates_data]],
        "distances": distances
        if distances is not None
        else [[1.0 - c["similarity"] for c in candidates_data]],
        "metadatas": [[c.get("metadata", {}) for c in candidates_data]],
    }
    # get() feeds the BM25 leg; empty is a valid (dense-only) configuration.
    mock_collection.get.return_value = {"ids": [], "documents": []}
    service._collection = mock_collection
    return service


@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_verbatim_clean_quote_returned(mock_embed, mock_rerank):
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    text = "Employees must report violations. More context follows."
    service = _make_service([{"text": text, "metadata": {"section_title": "Ethics", "page": 3}, "similarity": 0.8}])
    mock_rerank.return_value = [{
        "text": text,
        "metadata": {"section_title": "Ethics", "page": 3},
        "similarity": 0.8,
        "relevance_score": 4,
        "clean_quote": "Employees must report violations.",
    }]
    result = service.query("harassment case")
    assert result is not None
    assert result["quote"] == "Employees must report violations."
    assert result["section"] == "Ethics — Page 3"


@patch("app.rag.service.extract_clean_quote")
@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_non_verbatim_quote_replaced_by_raw_excerpt(mock_embed, mock_rerank, mock_extract):
    """Serialization-layer enforcement: a quote that is not a substring of its
    chunk never reaches the response — the raw chunk excerpt does instead."""
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    chunk = "[Ethics]\n\nThe genuine chunk body text about reporting."
    service = _make_service([{"text": chunk, "metadata": {}, "similarity": 0.8}])
    mock_rerank.return_value = [{
        "text": chunk,
        "metadata": {},
        "similarity": 0.8,
        "relevance_score": 4,
        "clean_quote": "A fabricated paraphrase.",
    }]
    mock_extract.return_value = None
    result = service.query("query")
    assert result is not None
    assert result["quote"] == "The genuine chunk body text about reporting."


@patch("app.rag.service.extract_clean_quote")
@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_falls_back_to_extractor_when_no_inline_quote(mock_embed, mock_rerank, mock_extract):
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    chunk = "Raw text with the extracted sentence inside it."
    service = _make_service([{"text": chunk, "metadata": {}, "similarity": 0.8}])
    mock_rerank.return_value = [
        {"text": chunk, "metadata": {}, "similarity": 0.8, "relevance_score": 4}
    ]
    mock_extract.return_value = "the extracted sentence"
    result = service.query("query")
    assert result["quote"] == "the extracted sentence"


@patch("app.rag.service.extract_clean_quote")
@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_extraction_failure_falls_back_to_raw_excerpt(mock_embed, mock_rerank, mock_extract):
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    chunk = "[Section]\n\nClean body sentence one. Clean body sentence two."
    service = _make_service([{"text": chunk, "metadata": {"page": "2"}, "similarity": 0.8}])
    mock_rerank.return_value = [
        {"text": chunk, "metadata": {"page": "2"}, "similarity": 0.8, "relevance_score": 3}
    ]
    mock_extract.return_value = None
    result = service.query("query")
    assert result is not None
    assert result["quote"] == "Clean body sentence one. Clean body sentence two."
    assert result["section"] == "Page 2"


@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_genuine_no_match_returns_none(mock_embed, mock_rerank):
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    service = _make_service([{"text": "text", "metadata": {}, "similarity": 0.8}])
    mock_rerank.return_value = []  # LLM ran; nothing met the threshold
    assert service.query("query") is None


@patch("app.rag.service.rerank_candidates")
@patch("app.embeddings.service.get_embedding_service")
def test_llm_outage_raises_unavailable(mock_embed, mock_rerank):
    """An LLM outage must never be rendered as 'no relevant provision exists'."""
    import pytest
    from app.rag.service import RetrievalUnavailable

    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    service = _make_service([{"text": "text", "metadata": {}, "similarity": 0.8}])
    mock_rerank.return_value = None  # fail closed: unavailable
    with pytest.raises(RetrievalUnavailable):
        service.query("query")


def test_missing_index_raises_unavailable():
    import pytest
    from app.rag.service import CorpusRetrievalService, RetrievalUnavailable

    service = CorpusRetrievalService("legal")
    service._available = False
    service._collection = object()  # skip re-init; simulate failed/empty index
    with pytest.raises(RetrievalUnavailable):
        service.query("query")


@patch("app.embeddings.service.get_embedding_service")
def test_similarity_clamped_and_filtered(mock_embed):
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    service = _make_service(
        [{"text": "some text", "metadata": {}, "similarity": 0.0}], distances=[[1.5]]
    )
    # similarity 0.0 < threshold → no candidates → None (no reranker call needed)
    assert service.query("query") is None


@patch("app.embeddings.service.get_embedding_service")
def test_missing_distances_handled(mock_embed):
    """Chroma responses without distances must not crash candidate parsing."""
    mock_embed.return_value.embed_text.return_value = [0.1] * 8
    service = PolicyRAGService()
    service._available = True
    mock_collection = MagicMock()
    mock_collection.count.return_value = 1
    mock_collection.query.return_value = {
        "ids": [["chunk_0"]],
        "documents": [["some text"]],
        "distances": None,
        "metadatas": None,
    }
    mock_collection.get.return_value = {"ids": [], "documents": []}
    service._collection = mock_collection
    # distance defaults to 1.0 → similarity 0 → filtered → None. No exception.
    assert service.query("query") is None


def test_config_threshold_respected(monkeypatch):
    """MIN_SIMILARITY comes from settings, not a module constant."""
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "RAG_MIN_SIMILARITY", 0.99)
    service = _make_service([{"text": "text", "metadata": {}, "similarity": 0.8}])
    with patch("app.embeddings.service.get_embedding_service") as mock_embed:
        mock_embed.return_value.embed_text.return_value = [0.1] * 8
        assert service.query("query") is None  # 0.8 < 0.99 → filtered out


# ── Helpers ──────────────────────────────────────────────────────────────────


def test_strip_section_prefix():
    assert strip_section_prefix("[Speak Up]\n\nBody text.") == "Body text."
    assert strip_section_prefix("No prefix here.") == "No prefix here."


def test_raw_excerpt_cuts_at_sentence_boundary():
    body = ("First sentence of the policy body. " * 20).strip()
    excerpt = _raw_excerpt(f"[Sec]\n\n{body}")
    assert excerpt is not None
    assert len(excerpt) <= 400
    assert excerpt.endswith(".")
    assert body.startswith(excerpt[: len(excerpt) - 1])


def test_raw_excerpt_empty_body():
    assert _raw_excerpt("[Sec]\n\n") is None
