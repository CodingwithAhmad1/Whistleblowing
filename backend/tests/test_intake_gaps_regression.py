"""
Regression: intake gap config in code vs persisted store, including default template text.

Failing tests here mean data/settings.json (or admin) drifted from app/prompts/intake_gaps.py.
Reset via Admin "reset gaps" or POST /api/admin/intake-gaps/reset, then re-save to repo if desired.
"""

import copy

from app.prompts.intake_gaps import DEFAULT_INTAKE_GAPS
from app.settings import get_intake_gaps


def _gap_sig(g: dict) -> tuple:
    return (
        g["id"],
        g["label"],
        g.get("active", True),
        g.get("template", "").strip(),
        g.get("criteria", {}).get("type"),
        g.get("criteria", {}).get("field"),
    )


def test_code_default_gap_templates_allow_already_provided() -> None:
    """Templates should invite 'already provided' so reporters can skip duplicate answers."""
    for g in DEFAULT_INTAKE_GAPS:
        t = (g.get("template") or "").lower()
        assert "already provided" in t, f"Gap {g['id']!r} template should include 'already provided'"
        assert len(g.get("template", "")) <= 300, f"Gap {g['id']!r} template over MAX_QUESTION_CHARS policy"


def test_code_default_five_gaps_with_distinct_ids() -> None:
    ids = [g["id"] for g in DEFAULT_INTAKE_GAPS]
    assert len(ids) == len(set(ids))
    assert len(ids) == 5


def test_persisted_gaps_match_code_defaults() -> None:
    """Runtime gap list (from settings file or defaults) must match DEFAULT_INTAKE_GAPS."""
    live = get_intake_gaps()
    expected = copy.deepcopy(DEFAULT_INTAKE_GAPS)
    assert len(live) == len(expected), (
        f"Gap count mismatch: got {len(live)}, expected {len(expected)}. "
        "Sync data/settings.json intakeGaps to DEFAULT_INTAKE_GAPS."
    )
    by_id = {g["id"]: g for g in live}
    for ex in expected:
        g = by_id.get(ex["id"])
        assert g is not None, f"Missing gap id {ex['id']!r} in get_intake_gaps()"
        assert _gap_sig(g) == _gap_sig(ex), (
            f"Drift for {ex['id']!r}: run Admin reset or align data/settings.json to intake_gaps.py"
        )
