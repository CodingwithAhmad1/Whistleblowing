"""Prompt for constrained amendment generation (Component C2).

Every proposal is an adaptation of a retrieved anchor clause — never a free
draft. The model returns proposed text + rationale; diff spans are computed
server-side with difflib and never trusted from the model.
"""

AMENDMENT_PROMPT_TEMPLATE = """\
You are drafting a proposed revision to one clause of a company conduct policy.

Several similar reports describe conduct that the current policy does not \
clearly cover. Your task is to ADAPT the anchor clause below so it would cover \
this conduct — a minimal, surgical revision, not a rewrite.

Reported conduct (extracted summaries of {n_reports} similar reports):
{conduct_summaries}

ANCHOR CLAUSE (current policy text — revise this):
{anchor_text}

APPLICABLE LEGAL PROVISION (context for what the law requires):
{legal_text}

Rules:
- Keep as much of the anchor's original wording, tone, and structure as possible.
- Change or add only what is needed to cover the reported conduct.
- Do not invent policy areas unrelated to the reported conduct.
- Do not reference specific reports, people, or incidents in the clause text.

Output ONLY valid JSON:
{{
  "proposed_text": "The full revised clause text",
  "rationale": "1-2 sentences: what changed and why, citing the legal provision"
}}

JSON output:"""
