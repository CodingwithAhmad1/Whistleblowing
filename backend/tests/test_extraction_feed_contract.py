"""
Contract: extraction dict fields expected by the frontend Feed Summary (feedStore / SummaryView).
Keep in sync with frontend/src/utils/feedStore.ts Layer1Extraction and routers/questions (minus _used_defaults in JSON).
"""

from app.question_processors.extraction_augmentation import augment_extraction_with_form
from app.question_processors.intake_processor import Layer1Result

# Populated in API response (used_defaults stripped); backend Layer1 still has _used_defaults internally.
FEED_EXTRACTION_JSON_KEYS = frozenset(
    {
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
)


def test_augmented_extraction_has_feed_required_keys() -> None:
    base: Layer1Result = {  # type: ignore[assignment]
        "summary": "",
        "dates_mentioned": [],
        "people_mentioned": [],
        "locations_mentioned": [],
        "specific_examples_present": False,
        "evidence_described": False,
        "timeline_clear": False,
        "witnesses_mentioned": False,
        "prior_reporting_mentioned": False,
        "impact_described": False,
        "retaliation_mentioned": False,
        "allegation_type": [],
        "length_character_count": 0,
        "_used_defaults": True,
    }
    out = augment_extraction_with_form(
        base,
        {
            "general_nature": "Test nature.",
            "when_occurred": "2025-01-01",
        },
    )
    as_api = {k: v for k, v in out.items() if k != "_used_defaults"}
    assert set(as_api.keys()) == FEED_EXTRACTION_JSON_KEYS, (
        "Update FEED_EXTRACTION_JSON_KEYS or frontend contract if shape changes"
    )
