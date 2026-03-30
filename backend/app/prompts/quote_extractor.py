"""Prompt template for extracting clean policy quotes from raw PDF chunks."""

QUOTE_EXTRACTOR_PROMPT = """\
You are extracting a clean policy quote from a raw PDF text chunk for a whistleblowing case.

Case summary:
{query}

Raw policy text (may contain PDF artifacts like navigation bars, sidebars, footers):
{raw_text}

Instructions:
- Extract the 1-3 most relevant sentences that state the actual policy rule or standard.
- Remove navigation text, sidebar callouts, page numbers, footers, and formatting artifacts.
- Preserve the EXACT original wording of the policy — do not paraphrase or add interpretation.
- If the text contains a clear policy statement, extract it. If it's mostly noise, return "NO_QUOTE".
- Output ONLY the extracted quote text, nothing else.

Clean policy quote:"""
