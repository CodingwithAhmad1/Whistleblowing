"""Ingest 3MRulesBook.pdf into ChromaDB for RAG policy retrieval.

Usage:
    cd backend && python ingest_policy.py
"""

import sys
from pathlib import Path

# Ensure backend app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

import pdfplumber
import chromadb

from app.embeddings.service import get_embedding_service

PDF_PATH = Path(__file__).resolve().parent.parent / "3MRulesBook.pdf"
CHROMA_PATH = str(Path(__file__).resolve().parent / "data" / "chroma")
COLLECTION_NAME = "whistleblowing_policy"

# Chunk size targets (word count)
MIN_WORDS = 100
MAX_WORDS = 350


def extract_text_from_pdf(pdf_path: Path) -> list[dict]:
    """Extract text from PDF, returning list of {text, page}."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            text = text.strip()
            if text:
                pages.append({"text": text, "page": i})
    return pages


def chunk_text(pages: list[dict]) -> list[dict]:
    """Split pages into paragraph-level chunks within word-count range."""
    chunks = []

    for page_info in pages:
        text = page_info["text"]
        page_num = page_info["page"]

        # Split by double newlines (paragraph boundaries)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        # Merge short paragraphs, split long ones
        buffer = ""
        for para in paragraphs:
            candidate = (buffer + "\n\n" + para).strip() if buffer else para
            word_count = len(candidate.split())

            if word_count > MAX_WORDS:
                # Flush buffer if it has content
                if buffer and len(buffer.split()) >= MIN_WORDS:
                    chunks.append({"text": buffer, "page": page_num})
                    buffer = ""
                elif buffer:
                    # Buffer too short, merge with para and split by sentences
                    candidate = (buffer + "\n\n" + para).strip() if buffer else para
                    buffer = ""

                # Split long text by sentences
                sentences = candidate.replace(". ", ".\n").split("\n")
                sent_buffer = ""
                for sent in sentences:
                    sent_candidate = (sent_buffer + " " + sent).strip() if sent_buffer else sent
                    if len(sent_candidate.split()) > MAX_WORDS and sent_buffer:
                        chunks.append({"text": sent_buffer.strip(), "page": page_num})
                        sent_buffer = sent
                    else:
                        sent_buffer = sent_candidate
                if sent_buffer:
                    buffer = sent_buffer
            elif word_count >= MIN_WORDS:
                # Good size, could accept more
                buffer = candidate
            else:
                # Still short, keep accumulating
                buffer = candidate

        # Flush remaining buffer
        if buffer.strip():
            # If very short, merge with last chunk from same page
            if len(buffer.split()) < MIN_WORDS and chunks and chunks[-1]["page"] == page_num:
                chunks[-1]["text"] += "\n\n" + buffer.strip()
            else:
                chunks.append({"text": buffer.strip(), "page": page_num})

    return chunks


def main():
    if not PDF_PATH.exists():
        print(f"ERROR: PDF not found at {PDF_PATH}")
        sys.exit(1)

    print(f"Reading PDF: {PDF_PATH}")
    pages = extract_text_from_pdf(PDF_PATH)
    print(f"Extracted text from {len(pages)} pages")

    chunks = chunk_text(pages)
    print(f"Created {len(chunks)} chunks")

    # Initialize ChromaDB
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
        print(f"  Embedding chunk {i + 1}/{len(chunks)} (page {chunk['page']}, {len(chunk['text'].split())} words)...")
        embedding = embedding_service.embed_text(chunk["text"])
        collection.add(
            ids=[f"chunk_{i}"],
            documents=[chunk["text"]],
            embeddings=[embedding],
            metadatas=[{"page": str(chunk["page"])}],
        )

    print(f"\nDone! Stored {collection.count()} chunks in ChromaDB at {CHROMA_PATH}")


if __name__ == "__main__":
    main()
