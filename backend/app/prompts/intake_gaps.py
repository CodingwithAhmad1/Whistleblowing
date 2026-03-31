"""
Default gap configurations for the deterministic intake workflow.

Each gap defines:
- id: unique slug
- label: human-readable name
- priority: lower = higher priority (1 is highest)
- active: whether gap is evaluated by default
- criteria: deterministic check against Layer 1 extraction JSON
- template: standard question text
"""

DEFAULT_INTAKE_GAPS: list[dict] = [
    {
        "id": "timeline_unclear",
        "label": "Timeline Unclear",
        "priority": 1,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "timeline_clear",
            "threshold": None,
        },
        "template": (
            "To clarify the sequence of events, could you describe what happened "
            "first and what happened next?"
        ),
    },
    {
        "id": "no_specific_example",
        "label": "No Specific Example",
        "priority": 2,
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
        "id": "no_evidence",
        "label": "No Evidence Mentioned",
        "priority": 3,
        "active": True,
        "criteria": {
            "type": "boolean_false",
            "field": "evidence_described",
            "threshold": None,
        },
        "template": (
            "To ensure accurate review, do you have any documents, emails, screenshots, "
            "or other materials related to this?"
        ),

    },
    {
        "id": "missing_date",
        "label": "Missing Date",
        "priority": 4,
        "active": True,
        "criteria": {
            "type": "empty_array",
            "field": "dates_mentioned",
            "threshold": None,
        },
        "template": (
            "To clarify timing, do you recall approximately when this occurred "
            "(month and year if possible)?"
        ),

    },
    {
        "id": "missing_individuals",
        "label": "Missing Named Individuals",
        "priority": 5,
        "active": True,
        "criteria": {
            "type": "empty_array",
            "field": "people_mentioned",
            "threshold": None,
        },
        "template": (
            "For documentation purposes, were any specific individuals involved "
            "that you can name?"
        ),

    },
    {
        "id": "missing_location",
        "label": "Missing Location",
        "priority": 6,
        "active": True,
        "criteria": {
            "type": "empty_array",
            "field": "locations_mentioned",
            "threshold": None,
        },
        "template": "To ensure accurate review, where did this take place?",

    },
    {
        "id": "narrative_too_short",
        "label": "Narrative Too Short",
        "priority": 7,
        "active": True,
        "criteria": {
            "type": "length_threshold",
            "field": "length_character_count",
            "threshold": 300,
        },
        "template": (
            "To better understand your report, could you provide more detail "
            "about what occurred?"
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
    "length_character_count": "number",
}

# Which field types each criteria type can operate on.
CRITERIA_FIELD_COMPAT: dict[str, set[str]] = {
    "boolean_false": {"boolean"},
    "empty_array": {"array"},
    "length_threshold": {"number"},
}
