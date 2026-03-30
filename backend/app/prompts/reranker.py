"""Prompt template for LLM-based relevance re-ranking of policy quote candidates."""

RERANKER_PROMPT_TEMPLATE = """\
You are evaluating policy document relevance for a whistleblowing case.

Case summary:
{query}

Rate each candidate policy excerpt's relevance to the case on a scale of 1-5:
1 = Not relevant at all
2 = Tangentially related
3 = Somewhat relevant
4 = Clearly relevant
5 = Highly relevant, directly addresses the case

Output ONLY valid JSON — an array of objects with "index" and "score" fields.
Example: [{{"index": 0, "score": 4}}, {{"index": 1, "score": 2}}]

Candidates:
{numbered_candidates}

JSON output:"""
