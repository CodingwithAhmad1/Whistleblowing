"""Corpus-parameterized RAG retrieval over ChromaDB with hybrid search.

Two corpora per the spec (Component B):
  policy — firm conduct policy (collection corpus_policy)
  legal  — statute/directive text (collection corpus_legal)

Retrieval: dense (Gemini embeddings) + BM25 lexical leg, fused via reciprocal
rank fusion, then LLM re-ranking. Every returned quote is verified verbatim
against its source chunk at this layer (never trust prompt instructions), and
carries a pinned reference: corpus, document_id, section, char_span.
"""

import logging
import re
from pathlib import Path
from typing import Optional

from ..config import settings
from .reranker import rerank_candidates, format_section
from .quote_extractor import extract_clean_quote
from .verbatim import find_verbatim_span, is_verbatim

logger = logging.getLogger(__name__)

CHROMA_PATH = str(Path(__file__).resolve().parent.parent.parent / "data" / "chroma")

COLLECTIONS = {"policy": "corpus_policy", "legal": "corpus_legal"}
# Pre-dual-corpus index name; readable until the first ingest_corpus.py run.
LEGACY_COLLECTIONS = {"policy": "whistleblowing_policy"}

_services: dict[str, "CorpusRetrievalService"] = {}


class RetrievalUnavailable(Exception):
    """The retrieval pipeline could not run (LLM outage, quota, missing index).

    Distinct from a genuine no-match (query() → None): callers must never
    render unavailability as "no relevant provision exists"."""


# Chunks are stored with a "[Section Title]" prefix added at ingest for embedding
# context; it is not part of the source document and must never be quoted.
_SECTION_PREFIX_RE = re.compile(r"^\[[^\]\n]{1,120}\]\s*\n+")


def strip_section_prefix(chunk_text: str) -> str:
    """Remove the ingest-added [Section] prefix from a stored chunk."""
    return _SECTION_PREFIX_RE.sub("", chunk_text, count=1)


def _raw_excerpt(chunk_text: str, max_chars: int = 400) -> str | None:
    """Verbatim fallback: the first sentences of the chunk body, cut at a
    sentence boundary. Used when no LLM-extracted quote survives verification."""
    body = strip_section_prefix(chunk_text).strip()
    if not body:
        return None
    if len(body) <= max_chars:
        return body
    cut = body[:max_chars]
    # Prefer ending at the last sentence boundary inside the window.
    last_period = cut.rfind(". ")
    if last_period > 100:
        return cut[: last_period + 1]
    return cut.rsplit(" ", 1)[0] + "…"


def _quote_char_span(quote: str, chunk_text: str, metadata: dict) -> tuple[int, int] | None:
    """Pin a quote to the canonical document text via the chunk's char span."""
    chunk_start = metadata.get("char_start")
    if not isinstance(chunk_start, int) or chunk_start < 0:
        return None
    body = strip_section_prefix(chunk_text)
    rel = find_verbatim_span(quote.rstrip("…"), body)
    if rel is None:
        return None
    return (chunk_start + rel[0], chunk_start + rel[1])


class CorpusRetrievalService:
    """Retrieves verbatim excerpts from one corpus with hybrid search + LLM re-ranking."""

    def __init__(self, corpus: str):
        if corpus not in COLLECTIONS:
            raise ValueError(f"Unknown corpus {corpus!r}; expected one of {sorted(COLLECTIONS)}")
        self.corpus = corpus
        self._collection = None
        self._available = False
        self._lexical = None

    # ── Initialization ────────────────────────────────────────────────────────

    def _ensure_initialized(self):
        if self._collection is not None:
            return
        try:
            import chromadb
            client = chromadb.PersistentClient(path=CHROMA_PATH)
            name = COLLECTIONS[self.corpus]
            try:
                self._collection = client.get_collection(name)
            except Exception:
                legacy = LEGACY_COLLECTIONS.get(self.corpus)
                if not legacy:
                    raise
                self._collection = client.get_collection(legacy)
                logger.warning(
                    "CorpusRAG[%s]: using legacy collection %r — run ingest_corpus.py "
                    "to migrate (adds document_id/char_span provenance)",
                    self.corpus,
                    legacy,
                )
            count = self._collection.count()
            self._available = count > 0

            # Guard against index/model drift: a collection embedded with a
            # different model or dimensionality returns garbage similarities.
            meta = self._collection.metadata or {}
            indexed_model = meta.get("embedding_model")
            indexed_dims = meta.get("embedding_dimensions")
            if indexed_model and indexed_model != settings.GEMINI_EMBEDDING_MODEL:
                logger.error(
                    "CorpusRAG[%s] DISABLED: index embedded with %r but settings use %r. Re-ingest.",
                    self.corpus, indexed_model, settings.GEMINI_EMBEDDING_MODEL,
                )
                self._available = False
            if indexed_dims and int(indexed_dims) != settings.EMBEDDING_DIMENSIONS:
                logger.error(
                    "CorpusRAG[%s] DISABLED: index has %s dims but settings use %s. Re-ingest.",
                    self.corpus, indexed_dims, settings.EMBEDDING_DIMENSIONS,
                )
                self._available = False
            if not indexed_model:
                logger.warning(
                    "CorpusRAG[%s]: collection has no embedding_model metadata (legacy ingest); "
                    "cannot verify index/model compatibility.",
                    self.corpus,
                )
            logger.info("CorpusRAG[%s] initialized: %d chunks", self.corpus, count)
        except Exception as e:
            logger.warning("CorpusRAG[%s] unavailable: %s", self.corpus, e)
            self._available = False

    def _ensure_lexical(self):
        """Build the BM25 leg lazily from the live collection."""
        if self._lexical is not None or not self._available:
            return
        try:
            from .lexical import LexicalIndex
            data = self._collection.get(include=["documents"])
            self._lexical = LexicalIndex(data["ids"], data["documents"])
            logger.info("CorpusRAG[%s]: BM25 index built (%d chunks)", self.corpus, len(data["ids"]))
        except Exception as e:
            logger.warning("CorpusRAG[%s]: BM25 index unavailable (%s); dense-only", self.corpus, e)
            self._lexical = None

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def _retrieve_candidates(self, query_text: str) -> list[dict]:
        """Hybrid retrieval: dense + BM25 fused via RRF, similarity-filtered."""
        from ..embeddings.service import get_embedding_service
        embedding = get_embedding_service().embed_text(query_text)

        n = settings.RAG_N_RESULTS
        # Query a wider dense window so BM25-surfaced chunks still get a dense
        # similarity (the corpora are small; 3n is cheap).
        dense_n = min(max(3 * n, 12), max(self._collection.count(), 1))
        results = self._collection.query(
            query_embeddings=[embedding],
            n_results=dense_n,
        )

        ids = (results.get("ids") or [[]])[0]
        documents = (results.get("documents") or [[]])[0]
        if not documents:
            return []
        distances = (results.get("distances") or [[]])[0]
        metadatas = (results.get("metadatas") or [[]])[0]

        by_id: dict[str, dict] = {}
        dense_rank: dict[str, int] = {}
        for i, doc in enumerate(documents):
            distance = distances[i] if i < len(distances) else 1.0
            similarity = max(0.0, 1.0 - distance)  # clamp to avoid negative values
            metadata = metadatas[i] if i < len(metadatas) else {}
            cid = ids[i] if i < len(ids) else f"_pos_{i}"
            by_id[cid] = {"text": doc, "metadata": metadata, "similarity": similarity}
            dense_rank[cid] = i

        # BM25 leg + reciprocal rank fusion
        fused: dict[str, float] = {}
        k = settings.RAG_RRF_K
        for cid, rank in dense_rank.items():
            fused[cid] = fused.get(cid, 0.0) + 1.0 / (k + rank + 1)
        if settings.RAG_HYBRID_ENABLED:
            self._ensure_lexical()
            if self._lexical is not None:
                lex_ids = self._lexical.rank(query_text, top_n=n)
                for rank, cid in enumerate(lex_ids):
                    if cid not in by_id:
                        # Outside the dense window → no similarity available;
                        # skip rather than fabricate a score (logged for tuning).
                        logger.info(
                            "CorpusRAG[%s]: BM25 hit %s outside dense window; skipped",
                            self.corpus, cid,
                        )
                        continue
                    fused[cid] = fused.get(cid, 0.0) + 1.0 / (k + rank + 1)

        ordered = sorted(fused, key=fused.__getitem__, reverse=True)
        candidates = []
        for cid in ordered:
            c = by_id[cid]
            if c["similarity"] >= settings.RAG_MIN_SIMILARITY:
                candidates.append(c)
            if len(candidates) >= n:
                break

        logger.info(
            "CorpusRAG[%s]: %d dense hits, %d fused candidates above similarity %.2f",
            self.corpus, len(documents), len(candidates), settings.RAG_MIN_SIMILARITY,
        )
        return candidates

    def query(self, query_text: str) -> dict | None:
        """Query for the most relevant verbatim excerpt.

        Returns {"quote", "section", "similarity", "relevance_score", "corpus",
                 "document_id", "char_span", "interpretation"} for a match, or
        None for a GENUINE no-match. Raises RetrievalUnavailable when the
        pipeline could not run (LLM outage / missing index) — never conflate
        the two. Every returned quote is verified verbatim against its source
        chunk (serialization-layer enforcement).
        """
        self._ensure_initialized()
        if not self._available or not self._collection:
            raise RetrievalUnavailable(f"corpus {self.corpus!r} index unavailable")

        candidates = self._retrieve_candidates(query_text)

        if not candidates:
            logger.info("CorpusRAG[%s]: no candidates above similarity threshold", self.corpus)
            return None

        # Re-rank using LLM (returns filtered + sorted list; the quoted candidate
        # carries clean_quote, already verbatim-checked against its own text)
        ranked = rerank_candidates(query_text, candidates)

        if ranked is None:
            raise RetrievalUnavailable(f"corpus {self.corpus!r} re-ranking LLM unavailable")

        if not ranked:
            logger.info("CorpusRAG[%s]: no candidates passed LLM re-ranking threshold", self.corpus)
            return None

        # Try to get a verbatim quote, iterating through ranked candidates
        for candidate in ranked:
            metadata = candidate["metadata"]
            section = format_section(metadata)

            # Prefer the inline clean_quote from the re-ranker (no extra LLM call)
            clean_quote = candidate.get("clean_quote")

            if not clean_quote:
                # Fallback: dedicated quote extractor (extra LLM call)
                clean_quote = extract_clean_quote(query_text, candidate["text"])

            # Serialization-layer verbatim enforcement: re-verify against the
            # source chunk regardless of which path produced the quote.
            if clean_quote and not is_verbatim(clean_quote, candidate["text"]):
                logger.warning(
                    "CorpusRAG[%s]: quote failed verbatim verification; falling back to raw excerpt",
                    self.corpus,
                )
                clean_quote = None

            if not clean_quote:
                # Last resort: a raw excerpt of the chunk itself (verbatim by construction)
                clean_quote = _raw_excerpt(candidate["text"])

            if clean_quote:
                chunk_start = metadata.get("char_start")
                chunk_end = metadata.get("char_end")
                return {
                    "quote": clean_quote,
                    "section": section,
                    "similarity": candidate["similarity"],
                    "relevance_score": candidate.get("relevance_score"),
                    "corpus": metadata.get("corpus") or self.corpus,
                    "document_id": metadata.get("document_id"),
                    "char_span": _quote_char_span(clean_quote, candidate["text"], metadata),
                    # Model-authored text lives ONLY in this field, never in quote.
                    "interpretation": candidate.get("interpretation"),
                    # Full clause text + its span (anchor for amendment proposals).
                    "source_text": strip_section_prefix(candidate["text"]),
                    "source_char_span": (
                        (chunk_start, chunk_end)
                        if isinstance(chunk_start, int) and chunk_start >= 0
                        else None
                    ),
                }

        logger.info("CorpusRAG[%s]: all ranked candidates produced no usable quote", self.corpus)
        return None


# ── Singletons / back-compat ──────────────────────────────────────────────────


def get_retrieval_service(corpus: str) -> CorpusRetrievalService:
    """Lazy per-corpus singleton."""
    if corpus not in _services:
        _services[corpus] = CorpusRetrievalService(corpus)
    return _services[corpus]


# Back-compat alias (pipeline_runner, routers, tests)
class PolicyRAGService(CorpusRetrievalService):
    def __init__(self):
        super().__init__("policy")


def get_policy_rag_service() -> CorpusRetrievalService:
    return get_retrieval_service("policy")
