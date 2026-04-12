"""
Default gap configurations for the deterministic intake workflow.

Each gap defines:
- id: unique slug
- label: human-readable name
- priority: lower = higher priority (1 is highest)
- active: whether gap is evaluated by default
- criteria: deterministic check against Layer 1 extraction JSON
- template: standard question text

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
            "For documentation purposes, could you provide a specific example "
            "of when this occurred?"
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
            "Was anyone else present who could corroborate what you've described "
            "— witnesses or people who saw or heard the incident?"
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
            "Has this matter been raised or reported to anyone before "
            "(e.g., a manager, HR, or a hotline), and if so, what was the outcome?"
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
            "Who or what has been harmed by this, and in what way "
            "(people, finances, safety, reputation)?"
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
            "Have you experienced any retaliation for raising this, or do you "
            "have concerns about retaliation if you report?"
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
