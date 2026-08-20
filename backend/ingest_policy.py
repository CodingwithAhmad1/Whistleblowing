"""Structure-aware chunking for the 3M policy PDF (library module).

DEPRECATED as a script: ingestion now goes through ingest_corpus.py, which adds
document_id/char_span provenance, batched embeddings, and a safe collection swap:

    python ingest_corpus.py --corpus policy --source ../docs/3MRulesBook.pdf

The extraction/chunking functions below remain the policy-PDF implementation
and are imported by ingest_corpus.py.
"""

import re
import sys
from pathlib import Path

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pdfplumber

PDF_PATH = Path(__file__).resolve().parent.parent / "docs" / "3MRulesBook.pdf"
CHROMA_PATH = str(Path(__file__).resolve().parent / "data" / "chroma")
COLLECTION_NAME = "whistleblowing_policy"

# Chunk size targets (word count)
MIN_WORDS = 100
MAX_WORDS = 350

# ── Section header detection ─────────────────────────────────────────────────

# Known section titles from the 3M Code of Conduct table of contents.
# These are matched exactly (case-insensitive) for reliability.
_KNOWN_SECTIONS = {
    "an introduction to our code",
    "acting with unwavering integrity",
    "meet high standards",
    "escalation requirements",
    "demonstrate high-integrity leadership",
    "be good",
    "act with integrity",
    "speak up",
    "be honest",
    "business courtesies",
    "interacting with business partners",
    "bribery",
    "fair competition",
    "political activities",
    "be fair",
    "conflicts of interest",
    "3m's assets",
    "intellectual property",
    "protecting confidential information",
    "insider trading",
    "social media",
    "speaking for the company",
    "be accurate",
    "accurate books and records",
    "discrimination",
    "money laundering",
    "global trade compliance",
    "be respectful",
    "harassment and disrespectful behavior",
    "forced labor and human trafficking",
    "workplace safety",
    "sustainability",
    "be loyal",
    "integrity in sales and marketing",
}

# Patterns that signal a section header
_HEADER_PATTERNS = [
    # Numbered section: "1.", "1.1", "4.2.1", "Section 3:"
    re.compile(r"^(?:Section\s+)?\d+(?:\.\d+)*[\.\:\s]", re.IGNORECASE),
    # Short ALL CAPS lines (likely headers), at least 3 chars
    re.compile(r"^[A-Z][A-Z\s\-&,/]{2,}$"),
]

# Lines to skip as headers
_SKIP_PATTERNS = [
    re.compile(r"^\d+$"),
    re.compile(r"^page\s+\d+", re.IGNORECASE),
    re.compile(r"^Be 3M", re.IGNORECASE),  # Navigation bar line
]


def _is_likely_header(line: str) -> bool:
    """Heuristic: is this line likely a section header?"""
    line = line.strip()
    if not line or len(line) > 120:
        return False
    word_count = len(line.split())
    if word_count > 12:
        return False
    for skip in _SKIP_PATTERNS:
        if skip.match(line):
            return False
    # Check known sections first (most reliable)
    if line.lower() in _KNOWN_SECTIONS:
        return True
    for pat in _HEADER_PATTERNS:
        if pat.match(line):
            return True
    return False


def _extract_chapter(header: str) -> str | None:
    """Try to extract a chapter/section number from a header string."""
    m = re.match(r"^(?:Section\s+)?(\d+(?:\.\d+)*)", header, re.IGNORECASE)
    if m:
        return m.group(1)
    return None


# ── Text extraction ──────────────────────────────────────────────────────────

_NAV_BAR_RE = re.compile(
    r"^Be 3M\s+Be Good\s+Be Honest\s+Be Fair\s+Be Loyal\s+Be Accurate\s+Be Respectful\s*Contents?$",
    re.IGNORECASE,
)

# Individual nav bar fragments (when pdfplumber splits across lines)
_NAV_FRAGMENTS = re.compile(
    r"^(?:Be 3M|Be Good|Be Honest|Be Fair|Be Loyal|Be Accurate|Be Respectful|Contents)$",
    re.IGNORECASE,
)

# Footer / sidebar patterns common in the 3M Code of Conduct PDF
_ARTIFACT_PATTERNS = [
    re.compile(r"^Global Code of Conduct\s*$", re.IGNORECASE),
    re.compile(r"^Ask a question,?\s*raise a concern at 3MEthics\.com\s*$", re.IGNORECASE),
    re.compile(r"^For more information,?\s*see the following\s*$", re.IGNORECASE),
    re.compile(r"^resources?:\s*$", re.IGNORECASE),
    re.compile(r"^\d+\s+Global Code of Conduct", re.IGNORECASE),
]


def _strip_nav_bar(text: str) -> str:
    """Remove navigation bars, footers, and sidebar artifacts from extracted text."""
    lines = text.split("\n")
    is_nav = [bool(_NAV_FRAGMENTS.match(l.strip())) for l in lines]
    cleaned = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if _NAV_BAR_RE.match(stripped):
            continue
        if any(pat.match(stripped) for pat in _ARTIFACT_PATTERNS):
            continue
        # Only strip nav fragment lines that appear adjacent to other nav fragments
        # (i.e. part of the sidebar cluster). An isolated "Be Respectful" that
        # appears after real content is a genuine section header — keep it.
        if is_nav[i]:
            adjacent = (i > 0 and is_nav[i - 1]) or (i < len(lines) - 1 and is_nav[i + 1])
            if adjacent:
                continue
        cleaned.append(line)
    return "\n".join(cleaned)


# Undecodable embedded-font glyphs leak from pdfplumber as "(cid:NN)" — strip
# them (and any whitespace runs they leave behind) or they pollute embeddings
# and surface verbatim in reporter-facing quotes and amendment anchors.
_CID_ARTIFACT_RE = re.compile(r"\(cid:\d+\)")


def _strip_cid_artifacts(text: str) -> str:
    text = _CID_ARTIFACT_RE.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", text)


def extract_pages(pdf_path: Path) -> list[dict]:
    """Extract text from PDF with page numbers."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            text = _strip_cid_artifacts(text)
            text = _strip_nav_bar(text)
            text = text.strip()
            if text:
                pages.append({"text": text, "page": i})

            # Also try to extract tables
            tables = page.extract_tables() or []
            for table in tables:
                table_text = _format_table(table)
                if table_text and len(table_text.split()) >= 10:
                    pages.append({
                        "text": table_text,
                        "page": i,
                        "type": "table",
                    })
    return pages


def _format_table(table: list[list]) -> str:
    """Convert a pdfplumber table to readable text."""
    if not table:
        return ""
    lines = []
    for row in table:
        cells = [_strip_cid_artifacts(str(c)).strip() if c else "" for c in row]
        line = " | ".join(c for c in cells if c)
        if line:
            lines.append(line)
    return "\n".join(lines)


# ── Structure-aware chunking ─────────────────────────────────────────────────

def chunk_pages(pages: list[dict]) -> list[dict]:
    """Split pages into chunks with section/chapter metadata.

    Each chunk gets: text, page, section_title, chapter, type.
    """
    chunks = []
    current_section = "Introduction"
    current_chapter = None

    for page_info in pages:
        text = page_info["text"]
        page_num = page_info["page"]
        content_type = page_info.get("type", "text")

        # For tables, store as a single chunk with current section context
        if content_type == "table":
            chunks.append({
                "text": text,
                "page": page_num,
                "section_title": current_section,
                "chapter": current_chapter or "",
                "type": "table",
            })
            continue

        # Split by double newlines
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        buffer = ""
        for para in paragraphs:
            # Check for section headers within the paragraph
            lines = para.split("\n")
            first_line = lines[0].strip() if lines else ""

            # Also try joining the first two lines — the PDF sometimes wraps
            # section titles across lines (e.g. "Harassment and \nDisrespectful Behavior")
            if not _is_likely_header(first_line) and len(lines) > 1:
                combined = (first_line + " " + lines[1].strip()).strip()
                if combined.lower() in _KNOWN_SECTIONS:
                    first_line = combined
                    lines = [combined] + lines[2:]

            # Scan remaining lines for a known section header embedded mid-paragraph.
            # This handles pages where a sidebar precedes the real section heading,
            # causing pdfplumber to merge both into one block (e.g. page 50 "Be Respectful").
            if not _is_likely_header(first_line):
                for ln in lines[1:]:
                    if ln.strip().lower() in _KNOWN_SECTIONS:
                        first_line = ln.strip()
                        break

            if _is_likely_header(first_line):
                # Flush buffer before starting new section
                if buffer.strip() and len(buffer.split()) >= MIN_WORDS:
                    chunks.append({
                        "text": buffer.strip(),
                        "page": page_num,
                        "section_title": current_section,
                        "chapter": current_chapter or "",
                        "type": "text",
                    })
                    buffer = ""

                # Update section tracking
                current_section = first_line.strip()
                chapter = _extract_chapter(current_section)
                if chapter:
                    current_chapter = chapter

                # If header has body text below it, include header as prefix
                if len(lines) > 1:
                    body = "\n".join(lines[1:]).strip()
                    if body:
                        para = f"{first_line}\n\n{body}"
                    else:
                        para = first_line
                else:
                    para = first_line

            # Accumulate text
            candidate = (buffer + "\n\n" + para).strip() if buffer else para
            word_count = len(candidate.split())

            if word_count > MAX_WORDS:
                # Flush buffer if it has content
                if buffer and len(buffer.split()) >= MIN_WORDS:
                    chunks.append({
                        "text": buffer.strip(),
                        "page": page_num,
                        "section_title": current_section,
                        "chapter": current_chapter or "",
                        "type": "text",
                    })
                    buffer = ""
                    candidate = para

                # Split long text by sentences
                sentences = candidate.replace(". ", ".\n").split("\n")
                sent_buffer = ""
                for sent in sentences:
                    sent_candidate = (sent_buffer + " " + sent).strip() if sent_buffer else sent
                    if len(sent_candidate.split()) > MAX_WORDS and sent_buffer:
                        chunks.append({
                            "text": sent_buffer.strip(),
                            "page": page_num,
                            "section_title": current_section,
                            "chapter": current_chapter or "",
                            "type": "text",
                        })
                        sent_buffer = sent
                    else:
                        sent_buffer = sent_candidate
                if sent_buffer:
                    buffer = sent_buffer
            else:
                buffer = candidate

        # Flush remaining buffer
        if buffer.strip():
            if len(buffer.split()) < MIN_WORDS and chunks and chunks[-1]["page"] == page_num:
                chunks[-1]["text"] += "\n\n" + buffer.strip()
            else:
                chunks.append({
                    "text": buffer.strip(),
                    "page": page_num,
                    "section_title": current_section,
                    "chapter": current_chapter or "",
                    "type": "text",
                })

    # Prepend section header to chunks that start mid-section for better embeddings
    for chunk in chunks:
        section = chunk.get("section_title", "")
        if section and not chunk["text"].startswith(section):
            chunk["text"] = f"[{section}]\n\n{chunk['text']}"

    return chunks


# ── Main (deprecated — use ingest_corpus.py) ─────────────────────────────────

def main():
    print(
        "NOTE: ingest_policy.py is deprecated as a script.\n"
        "Use: python ingest_corpus.py --corpus policy --source ../docs/3MRulesBook.pdf\n"
        "Continuing with the legacy single-collection ingest...\n"
    )
    dry_run = "--dry-run" in sys.argv

    if not PDF_PATH.exists():
        print(f"ERROR: PDF not found at {PDF_PATH}")
        sys.exit(1)

    print(f"Reading PDF: {PDF_PATH}")
    pages = extract_pages(PDF_PATH)
    text_pages = [p for p in pages if p.get("type") != "table"]
    table_pages = [p for p in pages if p.get("type") == "table"]
    print(f"Extracted text from {len(text_pages)} pages + {len(table_pages)} tables")

    chunks = chunk_pages(pages)
    print(f"Created {len(chunks)} chunks")

    # Chunk stats
    text_chunks = [c for c in chunks if c["type"] == "text"]
    table_chunks = [c for c in chunks if c["type"] == "table"]
    sections = set(c["section_title"] for c in chunks if c.get("section_title"))
    word_counts = [len(c["text"].split()) for c in chunks]

    print(f"  Text chunks: {len(text_chunks)}")
    print(f"  Table chunks: {len(table_chunks)}")
    print(f"  Unique sections: {len(sections)}")
    if word_counts:
        print(f"  Word count range: {min(word_counts)} - {max(word_counts)} (avg {sum(word_counts)//len(word_counts)})")

    if dry_run:
        print("\n── Dry run: chunk details ──")
        for i, chunk in enumerate(chunks):
            section = chunk.get("section_title", "?")
            chapter = chunk.get("chapter", "")
            page = chunk.get("page", "?")
            ctype = chunk.get("type", "text")
            words = len(chunk["text"].split())
            preview = chunk["text"][:80].replace("\n", " ")
            print(f"  [{i:3d}] p{page:>2} ch{chapter:<5} ({ctype:>5}, {words:>3}w) {section[:40]:<40}  {preview}…")
        print(f"\n── Sections detected ──")
        for s in sorted(sections):
            print(f"  - {s}")
        print("\nDry run complete. No data written.")
        return

    # Initialize ChromaDB
    import chromadb
    from app.embeddings.service import get_embedding_service

    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # Delete and recreate collection (idempotent)
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"Deleted existing collection '{COLLECTION_NAME}'")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Embed and store chunks
    embedding_service = get_embedding_service()

    for i, chunk in enumerate(chunks):
        section = chunk.get("section_title", "")
        chapter = chunk.get("chapter", "")
        ctype = chunk.get("type", "text")
        words = len(chunk["text"].split())
        print(f"  Embedding chunk {i + 1}/{len(chunks)} (p{chunk['page']}, {words}w, {section[:30]})...")

        embedding = embedding_service.embed_text(chunk["text"])
        collection.add(
            ids=[f"chunk_{i}"],
            documents=[chunk["text"]],
            embeddings=[embedding],
            metadatas=[{
                "page": str(chunk["page"]),
                "section_title": section,
                "chapter": chapter,
                "type": ctype,
            }],
        )

    print(f"\nDone! Stored {collection.count()} chunks in ChromaDB at {CHROMA_PATH}")


if __name__ == "__main__":
    main()
