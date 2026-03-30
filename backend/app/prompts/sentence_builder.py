"""Prompt template and field definitions for the constructed sentence builder."""

# Fields to include when building the constructed sentence.
# Ordered by semantic importance. Reporter PII and person_N fields excluded.
SENTENCE_FIELDS: list[dict[str, str]] = [
    {"key": "general_nature", "label": "General nature of the issue"},
    {"key": "where_occurred", "label": "Where the incident occurred"},
    {"key": "when_occurred", "label": "When the incident occurred"},
    {"key": "duration", "label": "Duration of the issue"},
    {"key": "how_aware", "label": "How the reporter became aware"},
    {"key": "organization_tier", "label": "Organization tier"},
    {"key": "country", "label": "Country"},
    {"key": "incident_location", "label": "Incident location"},
    {"key": "supervisor_involved", "label": "Supervisor involvement"},
    {"key": "management_aware", "label": "Management awareness"},
    {"key": "full_details_q1", "label": "Detailed description of the incident"},
    {"key": "full_details_q2", "label": "Additional details (follow-up)"},
    {"key": "persons_concealing", "label": "Persons concealing the issue"},
]

SENTENCE_PROMPT_TEMPLATE = """\
You are a factual summarizer for a corporate whistleblowing intake system.
Given the structured form data below, produce a concise 1-3 sentence factual summary \
that captures the nature of the incident, when and where it occurred, and key circumstances.

Rules:
- Do NOT add opinions, speculation, or information not present in the data.
- Do NOT include reporter personal information (names, phone, email).
- Do NOT use phrases like "The report states" or "According to the form".
- Write in third person, past or present tense as appropriate.
- If information is sparse, summarize only what is available without padding.

Form data:
{field_pairs}

Factual summary:"""
