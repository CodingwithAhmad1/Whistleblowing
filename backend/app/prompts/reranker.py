"""Prompt template for LLM-based relevance re-ranking of policy quote candidates."""

RERANKER_PROMPT_TEMPLATE = """\
You are evaluating policy document relevance for a whistleblowing case.

Case summary:
{query}

For each candidate policy excerpt:
1. Rate relevance to the case on a scale of 1-5:
   1 = Not relevant at all
   2 = Tangentially related
   3 = Somewhat relevant
   4 = Clearly relevant
   5 = Highly relevant, directly addresses the case

2. For the MOST relevant candidate (highest score, must be >= 3), extract a clean 1-3 sentence \
policy quote. Remove PDF artifacts (navigation bars, footers, page numbers, sidebar callouts). \
Preserve the EXACT original wording — do not paraphrase.

Output ONLY valid JSON with this structure:
{{
  "scores": [{{"index": 0, "score": 4}}, {{"index": 1, "score": 2}}],
  "best_quote": "The extracted clean policy quote text" or null if no candidate scores >= 3
}}

Candidates:
{numbered_candidates}

JSON output:"""
