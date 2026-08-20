"""Tests for the BM25 lexical leg and hybrid RRF fusion in retrieval."""

from unittest.mock import MagicMock, patch

from app.rag.lexical import LexicalIndex, tokenize
from app.rag.service import PolicyRAGService


def test_tokenize_lowercases_and_splits():
    assert tokenize("Insider-Trading, at 3M!") == ["insider", "trading", "at", "3m"]


def test_bm25_ranks_exact_term_match_first():
    idx = LexicalIndex(
        ids=["a", "b", "c", "d"],
        texts=[
            "Employees must avoid conflicts and disclose interests in procurement.",
            "Bribery and corruption are strictly prohibited by this code.",
            "Workplace safety procedures must be followed at all times.",
            "Accurate books and records must be maintained by every employee.",
        ],
    )
    assert idx.rank("bribery corruption payment", top_n=4)[0] == "b"


def test_bm25_empty_index_and_query():
    assert LexicalIndex([], []).rank("anything", 5) == []
    idx = LexicalIndex(["a"], ["some text"])
    assert idx.rank("!!!", 5) == []


def test_bm25_zero_score_ids_excluded():
    idx = LexicalIndex(
        ids=["a", "b", "c", "d"],
        texts=["alpha beta", "gamma delta", "epsilon zeta", "eta theta"],
    )
    ranked = idx.rank("alpha", top_n=5)
    assert ranked == ["a"]  # non-matching docs never appear with zero scores


@patch("app.embeddings.service.get_embedding_service")
def test_hybrid_fusion_boosts_lexical_match(mock_embed, monkeypatch):
    """A chunk ranked low by dense but top by BM25 should beat a chunk ranked
    slightly higher by dense but absent from BM25."""
    from app.config import settings

    monkeypatch.setattr(settings, "RAG_MIN_SIMILARITY", 0.1)
    monkeypatch.setattr(settings, "RAG_N_RESULTS", 2)
    mock_embed.return_value.embed_text.return_value = [0.1] * 8

    service = PolicyRAGService()
    service._available = True
    mock_collection = MagicMock()
    mock_collection.count.return_value = 3
    docs = [
        "generic ethics language",          # dense rank 0
        "insider trading is prohibited",    # dense rank 1, exact lexical match
        "travel expense reporting",         # dense rank 2
    ]
    mock_collection.query.return_value = {
        "ids": [["a", "b", "c"]],
        "documents": [docs],
        "distances": [[0.40, 0.42, 0.60]],
        "metadatas": [[{}, {}, {}]],
    }
    mock_collection.get.return_value = {"ids": ["a", "b", "c"], "documents": docs}
    service._collection = mock_collection

    candidates = service._retrieve_candidates("insider trading by a manager")
    assert candidates[0]["text"] == "insider trading is prohibited"


@patch("app.embeddings.service.get_embedding_service")
def test_hybrid_disabled_keeps_dense_order(mock_embed, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "RAG_HYBRID_ENABLED", False)
    monkeypatch.setattr(settings, "RAG_MIN_SIMILARITY", 0.1)
    monkeypatch.setattr(settings, "RAG_N_RESULTS", 2)
    mock_embed.return_value.embed_text.return_value = [0.1] * 8

    service = PolicyRAGService()
    service._available = True
    mock_collection = MagicMock()
    mock_collection.count.return_value = 2
    docs = ["first dense", "insider trading is prohibited"]
    mock_collection.query.return_value = {
        "ids": [["a", "b"]],
        "documents": [docs],
        "distances": [[0.40, 0.42]],
        "metadatas": [[{}, {}]],
    }
    service._collection = mock_collection

    candidates = service._retrieve_candidates("insider trading")
    assert candidates[0]["text"] == "first dense"
