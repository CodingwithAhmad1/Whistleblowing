"""
Default gap configurations for the deterministic intake workflow.

Each gap defines:
- id: unique slug
- label: human-readable name
- priority: lower = higher priority (1 is highest)
- active: whether gap is evaluated by default
- criteria: deterministic check against Layer 1 extraction JSON
- template: standard question text (max 300 characters; investigator-oriented prompts
  should ask for concrete, recordable details)

Layer 1 evaluates its booleans across the combined narrative
(full_details_q1 + sequence_of_events + evidence_description), so these
gaps fire only when the reporter has not addressed the topic in ANY of
the three standardised narrative answers.
"""

DEFAULT_INTAKE_GAPS: list[dict] = [
    {
        "id": "no_specific_example",
        "label": "No Specific Example",
        "priority": 1,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "specific_examples_present",
            "threshold": None,
        },
        "template": (
            "If you already gave this in your answers above, reply: already provided. "
            "Otherwise describe ONE incident: (1) date or timeframe (2) place "
            "(3) who was there (4) the key act or words (5) what happened next."
        ),
    },
    {
        "id": "no_witnesses_mentioned",
        "label": "No Witnesses Mentioned",
        "priority": 2,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "witnesses_mentioned",
            "threshold": None,
        },
        "template": (
            "If you already gave this in your answers above, reply: already provided. "
            "Who could independently verify this? For each, name/role, what they "
            "saw or heard, and their team/site. If none, say none and where records "
            "might exist (e.g. cal, sign-in, IT logs)."
        ),
    },
    {
        "id": "no_prior_reporting",
        "label": "No Prior Reporting Mentioned",
        "priority": 3,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "prior_reporting_mentioned",
            "threshold": None,
        },
        "template": (
            "If you already gave this in your answers above, reply: already provided. "
            "List any prior report: to whom, when, channel (e.g. email, hotline, "
            "in person), and outcome or reference. If you never reported before, state that."
        ),
    },
    {
        "id": "no_impact_described",
        "label": "No Impact Described",
        "priority": 4,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "impact_described",
            "threshold": None,
        },
        "template": (
            "If you already gave this in your answers above, reply: already provided. "
            "What harm: who or what is affected, what kind (safety, financial, people, "
            "reputation), what you observed, and is the impact still ongoing?"
        ),
    },
    {
        "id": "no_retaliation_context",
        "label": "No Retaliation Context",
        "priority": 5,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "retaliation_mentioned",
            "threshold": None,
        },
        "template": (
            "If you already gave this in your answers above, reply: already provided. "
            "Any adverse act since you raised this or because you might report: what, "
            "by whom, when, and is it still ongoing? Any fear of future retaliation?"
        ),
    },
]

# Valid criteria types for validation
VALID_CRITERIA_TYPES = {"boolean_false", "empty_array", "length_threshold"}

# Valid Layer1Result field names that criteria.field can reference
VALID_LAYER1_FIELDS = {
    "summary",
    "dates_mentioned",
    "people_mentioned",
    "locations_mentioned",
    "specific_examples_present",
    "evidence_described",
    "timeline_clear",
    "witnesses_mentioned",
    "prior_reporting_mentioned",
    "impact_described",
    "retaliation_mentioned",
    "allegation_type",
    "length_character_count",
}

# Maps each Layer1Result field to its logical type for criteria compatibility checks.
LAYER1_FIELD_TYPES: dict[str, str] = {
    "summary": "string",
    "dates_mentioned": "array",
    "people_mentioned": "array",
    "locations_mentioned": "array",
    "allegation_type": "array",
    "specific_examples_present": "boolean",
    "evidence_described": "boolean",
    "timeline_clear": "boolean",
    "witnesses_mentioned": "boolean",
    "prior_reporting_mentioned": "boolean",
    "impact_described": "boolean",
    "retaliation_mentioned": "boolean",
    "length_character_count": "number",
}

# Which field types each criteria type can operate on.
CRITERIA_FIELD_COMPAT: dict[str, set[str]] = {
    "boolean_false": {"boolean"},
    "empty_array": {"array"},
    "length_threshold": {"number"},
}
