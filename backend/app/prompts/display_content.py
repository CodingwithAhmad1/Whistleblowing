"""
Display content for the Full Details questionnaire.
Policy quote and question exist separately for Q3.
Placeholders: {context} = report context, {word_limit} = word limit.
"""

# Policy excerpt fallback when Gemini fails
FULL_DETAILS_Q3_POLICY_EXCERPT = (
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor "
    "incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud "
    "exercitation ullamco laboris."
)

# Question shown below the policy excerpt for Q3
FULL_DETAILS_Q3_QUESTION = "How well does this policy excerpt describe your experience?"

# Q2: default prompt (10-word question). Placeholders: {context}, {word_limit}
DEFAULT_Q2_PROMPT_TEMPLATE = (
    "Generate exactly one short question, exactly {word_limit} words, "
    "related to the following whistleblowing report. Be specific and relevant. "
    "Output ONLY the question, no quotes or extra text.\n\n"
    "Report:\n{context}\n\nQuestion:"
)

# Q3: default prompt (20-word policy quote). Placeholders: {word_limit}, {context}
DEFAULT_Q3_PROMPT_TEMPLATE = (
    "Generate a random, generic policy quote about whistleblowing or ethics, "
    "maximum {word_limit} words. Be professional. Output ONLY the quote, no quotes or extra text.\n\n"
    "Quote:"
)

# Word limits for templates
Q2_WORD_LIMIT = 10
Q3_WORD_LIMIT = 20
