"""
Default gap configurations for the deterministic intake workflow.

Each gap defines:
- id: unique slug
- label: human-readable name
- priority: lower = higher priority (1 is highest)
- active: whether gap is evaluated by default
- criteria: deterministic check against Layer 1 extraction JSON
- template: standard question text (max 300 characters; calm, professional wording
  for stressed reporters while still inviting concrete detail when they can share it)

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
            "If you can, one brief example really helps—roughly when, where, and what "
            "happened. If you've already included this in your answers, reply already provided."
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
            "Is there anyone who could corroborate what you shared, or any records "
            "that might help? Share only what you're comfortable with. If it's already "
            "in your answers, reply already provided."
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
            "Have you raised this concern before (for example with a manager or HR)? "
            "A short note on when and how helps; a simple no is fine too. If you "
            "already covered this above, reply already provided."
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
            "Has this affected you or others in any way you're willing to describe? "
            "A few words is fine. If you already covered this, reply already provided."
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
            "Have you noticed—or do you worry about—any negative response tied to "
            "speaking up? Share only what feels safe for you. If you already addressed "
            "this, reply already provided."
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
