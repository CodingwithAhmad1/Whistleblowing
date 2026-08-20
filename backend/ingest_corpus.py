"""Ingest a source document into a per-corpus ChromaDB collection for RAG.

Supports the two spec corpora:
  policy — the firm's conduct policy (PDF; structure-aware chunking)
  legal  — statute / directive text (EUR-Lex OJ XHTML; article-aware chunking)

Every chunk carries a pinned reference: corpus, document_id, section_title,
char_start/char_end into a canonical plain-text copy of the document written to
backend/data/corpus_text/<corpus>/<document_id>.txt — the source of truth for
serialization-layer verbatim checks.

Ingest builds into a temp collection and swaps on success, so a mid-run failure
never leaves a half-empty live index. Embeddings are batched with retry and
tagged task_type=RETRIEVAL_DOCUMENT.

Usage:
    cd backend
    python ingest_corpus.py --corpus policy --source ../docs/3MRulesBook.pdf [--dry-run]
    python ingest_corpus.py --corpus legal --source ../docs/legal/eu-directive-2019-1937.html [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

BACKEND_DIR = Path(__file__).resolve().parent
CHROMA_PATH = str(BACKEND_DIR / "data" / "chroma")
CORPUS_TEXT_DIR = BACKEND_DIR / "data" / "corpus_text"

COLLECTIONS = {"policy": "corpus_policy", "legal": "corpus_legal"}
DEFAULT_DOCUMENT_IDS = {
    "policy": "3m_code_of_conduct",
    "legal": "eu_directive_2019_1937",
}

# Chunk size targets (word count), shared with the policy chunker
MIN_WORDS = 100
MAX_WORDS = 350

_EMBED_MAX_RETRIES = 3
_BATCH_PAUSE_SECONDS = 20  # free-tier embedding quota is per-minute; pace batches


# ── Legal corpus: EUR-Lex OJ XHTML parsing ────────────────────────────────────


class _EurLexParser(HTMLParser):
    """Extracts recitals and articles from EUR-Lex Official Journal XHTML.

    Output: self.recitals = [(number, text)], self.articles = [
        {"article": "Article 1", "title": "Purpose", "chapter": str, "paragraphs": [str]}
    ]
    Footnotes (oj-note), citations, signatures, and the preamble scaffolding are skipped.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.recitals: list[tuple[int, str]] = []
        self.articles: list[dict] = []
        self._chapter_no = ""
        self._chapter_title = ""
        self._stack: list[tuple[str, str, str]] = []  # (tag, id, class)
        self._note_depth = 0
        self._current_article: dict | None = None
        self._current_recital_no: int | None = None
        self._text_target: str | None = None  # 'article_no'|'article_title'|'chapter'|'chapter_title'|'body'|'recital'
        self._buf: list[str] = []
        self._done = False

    # -- helpers --
    def _flush(self) -> None:
        text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
        self._buf = []
        target = self._text_target
        self._text_target = None
        if not text or target is None:
            return
        if target == "chapter":
            self._chapter_no = text
        elif target == "chapter_title":
            self._chapter_title = text
        elif target == "article_no" and self._current_article is not None:
            self._current_article["article"] = text
        elif target == "article_title" and self._current_article is not None:
            self._current_article["title"] = text
        elif target == "body" and self._current_article is not None:
            self._current_article["paragraphs"].append(text)
        elif target == "recital" and self._current_recital_no is not None:
            # Strip the leading "(N)" marker cell if present
            cleaned = re.sub(r"^\(\d+\)\s*", "", text).strip()
            if cleaned:
                if self.recitals and self.recitals[-1][0] == self._current_recital_no:
                    prev_no, prev_text = self.recitals[-1]
                    self.recitals[-1] = (prev_no, f"{prev_text} {cleaned}")
                else:
                    self.recitals.append((self._current_recital_no, cleaned))

    def _in_subdivision(self, prefix: str) -> str | None:
        for _, elem_id, _ in reversed(self._stack):
            if elem_id.startswith(prefix):
                return elem_id
        return None

    # -- HTMLParser hooks --
    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        attrs_d = dict(attrs)
        elem_id = attrs_d.get("id", "")
        cls = attrs_d.get("class", "")
        self._stack.append((tag, elem_id, cls))

        if "oj-note" in cls or "oj-super" in cls:
            self._note_depth += 1
            return
        if "oj-final" in cls:
            self._done = True
            return

        if elem_id.startswith("art_") and re.fullmatch(r"art_\d+", elem_id):
            self._flush()
            self._current_article = {
                "article": "",
                "title": "",
                "chapter": f"{self._chapter_no} — {self._chapter_title}".strip(" —"),
                "paragraphs": [],
            }
            self.articles.append(self._current_article)
        m = re.fullmatch(r"rct_(\d+)", elem_id)
        if m:
            self._flush()
            self._current_recital_no = int(m.group(1))

        if tag == "p" and self._note_depth == 0:
            self._flush()
            if "oj-ti-section-1" in cls:
                self._text_target = "chapter"
            elif "oj-ti-section-2" in cls:
                self._text_target = "chapter_title"
            elif "oj-ti-art" in cls:
                self._text_target = "article_no"
            elif "oj-sti-art" in cls:
                self._text_target = "article_title"
            elif "oj-normal" in cls or "oj-italic" in cls or "oj-bold" in cls:
                if self._current_article is not None and self._in_subdivision("art_"):
                    self._text_target = "body"
                elif self._in_subdivision("rct_"):
                    self._text_target = "recital"

    def handle_endtag(self, tag):
        if not self._stack:
            return
        _, _, cls = self._stack.pop()
        if "oj-note" in cls or "oj-super" in cls:
            self._note_depth = max(0, self._note_depth - 1)
        if tag == "p":
            self._flush()

    def handle_data(self, data):
        if self._done or self._note_depth:
            return
        if self._text_target is not None:
            self._buf.append(data)


def extract_legal_blocks(html_path: Path) -> list[dict]:
    """Parse EUR-Lex XHTML into ordered blocks: recital groups then articles.

    Each block: {"text", "section_title", "chapter", "article", "type"}.
    Recitals are grouped to chunk-sized batches; articles are split on
    paragraph boundaries when they exceed MAX_WORDS.
    """
    parser = _EurLexParser()
    parser.feed(html_path.read_text(encoding="utf-8"))

    blocks: list[dict] = []

    # Group consecutive recitals into ~chunk-sized batches.
    group: list[tuple[int, str]] = []
    group_words = 0

    def flush_group():
        nonlocal group, group_words
        if not group:
            return
        first, last = group[0][0], group[-1][0]
        label = f"Recital {first}" if first == last else f"Recitals {first}–{last}"
        text = "\n\n".join(f"({n}) {t}" for n, t in group)
        blocks.append({
            "text": text,
            "section_title": label,
            "chapter": "Preamble",
            "article": label,
            "type": "recital",
        })
        group, group_words = [], 0

    for no, text in parser.recitals:
        words = len(text.split())
        if group and group_words + words > MAX_WORDS:
            flush_group()
        group.append((no, text))
        group_words += words
    flush_group()

    # Articles: one block per article, split on paragraph boundaries if too long.
    for art in parser.articles:
        if not art["article"]:
            continue
        title = f"{art['article']} — {art['title']}".strip(" —")
        paragraphs = art["paragraphs"]
        parts: list[list[str]] = [[]]
        words = 0
        for para in paragraphs:
            w = len(para.split())
            if parts[-1] and words + w > MAX_WORDS:
                parts.append([])
                words = 0
            parts[-1].append(para)
            words += w
        for k, part in enumerate(parts):
            if not part:
                continue
            label = title if len(parts) == 1 else f"{title} (part {k + 1})"
            body = "\n\n".join(part)
            blocks.append({
                "text": f"{title}\n\n{body}" if k == 0 else f"{title} (cont.)\n\n{body}",
                "section_title": label,
                "chapter": art["chapter"],
                "article": art["article"],
                "type": "article",
            })
    return blocks


# ── Chunk assembly with char spans ────────────────────────────────────────────


def build_legal_chunks(html_path: Path) -> tuple[list[dict], str]:
    """Returns (chunks, canonical_text). Char spans are exact by construction:
    the canonical text is assembled from the same blocks as the chunks."""
    blocks = extract_legal_blocks(html_path)
    canonical_parts: list[str] = []
    chunks: list[dict] = []
    offset = 0
    for block in blocks:
        text = block["text"]
        start = offset
        end = start + len(text)
        canonical_parts.append(text)
        offset = end + 2  # "\n\n" joiner
        chunks.append({
            "text": text,
            "section_title": block["section_title"],
            "chapter": block["chapter"],
            "article": block["article"],
            "type": block["type"],
            "char_start": start,
            "char_end": end,
        })
    return chunks, "\n\n".join(canonical_parts)


def build_policy_chunks(pdf_path: Path) -> tuple[list[dict], str]:
    """PDF path: reuse the structure-aware policy chunker, then locate each
    chunk in the canonical page text to pin char spans."""
    from ingest_policy import chunk_pages, extract_pages
    from app.rag.verbatim import find_verbatim_span
    from app.rag.service import strip_section_prefix

    pages = extract_pages(pdf_path)
    canonical = "\n\n".join(p["text"] for p in pages)
    chunks = chunk_pages(pages)

    unpinned = 0
    out: list[dict] = []
    for chunk in chunks:
        body = strip_section_prefix(chunk["text"])
        span = find_verbatim_span(body, canonical)
        if span is None:
            # Sentence-split chunks may straddle rebuilt whitespace; try the
            # first 200 chars to at least pin the start region.
            span = find_verbatim_span(body[:200], canonical)
        if span is None:
            unpinned += 1
        out.append({
            "text": chunk["text"],
            "section_title": chunk.get("section_title", ""),
            "chapter": chunk.get("chapter", ""),
            "page": str(chunk.get("page", "")),
            "type": chunk.get("type", "text"),
            "char_start": span[0] if span else -1,
            "char_end": span[1] if span else -1,
        })
    if unpinned:
        print(f"  WARNING: {unpinned}/{len(out)} chunks could not be pinned to a char span")
    return out, canonical


# ── Embedding + collection swap ───────────────────────────────────────────────


def embed_all(texts: list[str]) -> list[list[float]]:
    from app.embeddings.service import get_embedding_service

    service = get_embedding_service()
    vectors: list[list[float]] = []
    batch_size = 25
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        for attempt in range(1, _EMBED_MAX_RETRIES + 1):
            try:
                vectors.extend(service.embed_documents(batch))
                break
            except Exception as e:
                if attempt == _EMBED_MAX_RETRIES:
                    raise
                # Free-tier embedding quotas are per-minute; wait a full window.
                wait = 70 if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e) else 2**attempt
                print(f"  embed batch failed ({e}); retry {attempt}/{_EMBED_MAX_RETRIES} in {wait}s", flush=True)
                time.sleep(wait)
        done = min(start + batch_size, len(texts))
        print(f"  Embedded {done}/{len(texts)} chunks", flush=True)
        if done < len(texts):
            time.sleep(_BATCH_PAUSE_SECONDS)  # stay under per-minute rate limits
    return vectors


def write_to_collection(corpus: str, document_id: str, chunks: list[dict]) -> None:
    import chromadb
    from app.config import settings

    live_name = COLLECTIONS[corpus]
    tmp_name = f"{live_name}_ingest_tmp"
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # Fresh temp collection (drop any stale leftover from a failed run)
    try:
        client.delete_collection(tmp_name)
    except Exception:
        pass
    collection = client.create_collection(
        name=tmp_name,
        metadata={
            "hnsw:space": "cosine",
            "embedding_model": settings.GEMINI_EMBEDDING_MODEL,
            "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
            "corpus": corpus,
            "document_id": document_id,
        },
    )

    print(f"Embedding {len(chunks)} chunks (batched, task_type=RETRIEVAL_DOCUMENT)...")
    vectors = embed_all([c["text"] for c in chunks])

    collection.add(
        ids=[f"{document_id}_chunk_{i}" for i in range(len(chunks))],
        documents=[c["text"] for c in chunks],
        embeddings=vectors,
        metadatas=[
            {
                "corpus": corpus,
                "document_id": document_id,
                "section_title": c["section_title"],
                "chapter": c.get("chapter", ""),
                "page": c.get("page", ""),
                "article": c.get("article", ""),
                "type": c["type"],
                "char_start": int(c["char_start"]),
                "char_end": int(c["char_end"]),
            }
            for c in chunks
        ],
    )

    count = collection.count()
    if count != len(chunks):
        raise RuntimeError(f"Temp collection has {count} chunks, expected {len(chunks)}; aborting swap")

    # Swap: the live index is only touched after the temp build fully succeeded.
    try:
        client.delete_collection(live_name)
    except Exception:
        pass
    collection.modify(name=live_name)
    print(f"Swapped into live collection '{live_name}' ({count} chunks)")


def write_canonical_text(corpus: str, document_id: str, canonical: str, source: Path, n_chunks: int) -> None:
    from app.config import settings

    out_dir = CORPUS_TEXT_DIR / corpus
    out_dir.mkdir(parents=True, exist_ok=True)
    text_path = out_dir / f"{document_id}.txt"
    text_path.write_text(canonical, encoding="utf-8")

    manifest_path = out_dir / f"{document_id}.manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "document_id": document_id,
                "corpus": corpus,
                "source_file": source.name,
                "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
                "chunk_count": n_chunks,
                "embedding_model": settings.GEMINI_EMBEDDING_MODEL,
                "embedding_dimensions": settings.EMBEDDING_DIMENSIONS,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Canonical text: {text_path} ({len(canonical)} chars)")


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--corpus", required=True, choices=sorted(COLLECTIONS))
    ap.add_argument("--source", required=True, help="Path to the source document (PDF for policy, EUR-Lex XHTML for legal)")
    ap.add_argument("--document-id", default=None, help="Stable document id (default per corpus)")
    ap.add_argument("--dry-run", action="store_true", help="Chunk and report; write nothing")
    args = ap.parse_args()

    source = Path(args.source).resolve()
    if not source.exists():
        print(f"ERROR: source not found at {source}")
        sys.exit(1)
    document_id = args.document_id or DEFAULT_DOCUMENT_IDS[args.corpus]

    print(f"Corpus: {args.corpus} | document_id: {document_id}\nSource: {source}")

    if args.corpus == "policy":
        chunks, canonical = build_policy_chunks(source)
    else:
        chunks, canonical = build_legal_chunks(source)

    words = [len(c["text"].split()) for c in chunks]
    sections = {c["section_title"] for c in chunks if c["section_title"]}
    print(f"Created {len(chunks)} chunks | {len(sections)} sections | "
          f"words {min(words)}–{max(words)} (avg {sum(words)//len(words)})")

    if args.dry_run:
        for i, c in enumerate(chunks):
            preview = c["text"][:70].replace("\n", " ")
            print(f"  [{i:3d}] ({c['type']:>7}, {len(c['text'].split()):>3}w, "
                  f"span {c['char_start']}-{c['char_end']}) {c['section_title'][:45]:<45} {preview}…")
        print("\nDry run complete. No data written.")
        return

    write_canonical_text(args.corpus, document_id, canonical, source, len(chunks))
    write_to_collection(args.corpus, document_id, chunks)
    print("Done.")


if __name__ == "__main__":
    main()
