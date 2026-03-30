"""RAG service for policy document retrieval using ChromaDB."""

import logging
from pathlib import Path
from typing import Optional

from .reranker import rerank_candidates, _format_section
from .quote_extractor import extract_clean_quote

logger = logging.getLogger(__name__)

CHROMA_PATH = str(Path(__file__).resolve().parent.parent.parent / "data" / "chroma")
COLLECTION_NAME = "whistleblowing_policy"
MIN_SIMILARITY = 0.3
N_RESULTS = 5

_service: Optional["PolicyRAGService"] = None


class PolicyRAGService:
    """Retrieves relevant policy quotes from ChromaDB with LLM re-ranking."""

    def __init__(self):
        self._collection = None
        self._available = False

    def _ensure_initialized(self):
        if self._collection is not None:
            return
        try:
            import chromadb
            client = chromadb.PersistentClient(path=CHROMA_PATH)
            self._collection = client.get_collection(COLLECTION_NAME)
            count = self._collection.count()
            self._available = count > 0
            logger.info(f"PolicyRAG initialized: {count} chunks in collection")
        except Exception as e:
            logger.warning(f"PolicyRAG unavailable: {e}")
            self._available = False

    def _retrieve_candidates(self, query_text: str) -> list[dict]:
        """Retrieve top N candidates from ChromaDB with similarity filtering."""
        from ..embeddings.service import get_embedding_service
        embedding = get_embedding_service().embed_text(query_text)

        results = self._collection.query(
            query_embeddings=[embedding],
            n_results=N_RESULTS,
        )

        if not results["documents"] or not results["documents"][0]:
            return []

        candidates = []
        for i, doc in enumerate(results["documents"][0]):
            distance = results["distances"][0][i] if results["distances"] else 1.0
            similarity = 1.0 - distance
            metadata = results["metadatas"][0][i] if results["metadatas"] else {}

            if similarity >= MIN_SIMILARITY:
                candidates.append({
                    "text": doc,
                    "metadata": metadata,
                    "similarity": similarity,
                })

        logger.info(
            f"PolicyRAG: {len(results['documents'][0])} retrieved, "
            f"{len(candidates)} above similarity threshold {MIN_SIMILARITY}"
        )
        return candidates

    def query(self, query_text: str) -> dict | None:
        """Query for the most relevant policy quote.

        Returns {"quote": str, "section": str|None, "similarity": float,
                 "relevance_score": int|None} or None.
        """
        self._ensure_initialized()
        if not self._available or not self._collection:
            return None

        try:
            candidates = self._retrieve_candidates(query_text)

            if not candidates:
                logger.info("PolicyRAG: no candidates above similarity threshold")
                return None

            # Re-rank using LLM (returns filtered + sorted list)
            ranked = rerank_candidates(query_text, candidates)

            if not ranked:
                logger.info("PolicyRAG: no candidates passed LLM re-ranking threshold")
                return None

            best = ranked[0]
            section = _format_section(best["metadata"])

            # Extract a clean quote from the raw chunk text
            clean_quote = extract_clean_quote(query_text, best["text"])

            return {
                "quote": clean_quote,
                "section": section,
                "similarity": best["similarity"],
                "relevance_score": best.get("relevance_score"),
            }
        except Exception as e:
            logger.error(f"PolicyRAG query failed: {e}")
            return None


def get_policy_rag_service() -> PolicyRAGService:
    """Lazy singleton."""
    global _service
    if _service is None:
        _service = PolicyRAGService()
    return _service
