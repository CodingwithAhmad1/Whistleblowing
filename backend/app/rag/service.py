"""RAG service for policy document retrieval using ChromaDB."""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

CHROMA_PATH = str(Path(__file__).resolve().parent.parent.parent / "data" / "chroma")
COLLECTION_NAME = "whistleblowing_policy"
MIN_SIMILARITY = 0.3

_service: Optional["PolicyRAGService"] = None


class PolicyRAGService:
    """Retrieves relevant policy quotes from ChromaDB."""

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

    def query(self, query_text: str) -> dict | None:
        """Query for the most relevant policy quote.

        Returns {"quote": str, "section": str|None} or None.
        """
        self._ensure_initialized()
        if not self._available or not self._collection:
            return None

        try:
            from ..embeddings.service import get_embedding_service
            embedding = get_embedding_service().embed_text(query_text)

            results = self._collection.query(
                query_embeddings=[embedding],
                n_results=1,
            )

            if not results["documents"] or not results["documents"][0]:
                return None

            # ChromaDB returns distances (L2 by default), but we stored with cosine
            # Lower distance = more similar for cosine distance
            distance = results["distances"][0][0] if results["distances"] else 1.0
            # ChromaDB cosine distance = 1 - cosine_similarity
            similarity = 1.0 - distance

            if similarity < MIN_SIMILARITY:
                logger.info(f"PolicyRAG: best match similarity {similarity:.3f} below threshold {MIN_SIMILARITY}")
                return None

            quote = results["documents"][0][0]
            metadata = results["metadatas"][0][0] if results["metadatas"] else {}
            section = metadata.get("section") or metadata.get("page")

            return {
                "quote": quote,
                "section": f"Page {section}" if section else None,
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
