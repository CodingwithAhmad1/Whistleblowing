"""Ensure report field lists stay aligned across prompt, model, and chat extraction."""

import app.storage as storage_mod
from app.models import ReportCreate
from app.prompts.core import REPORT_FIELDS


def test_report_create_matches_report_fields_keys():
    model_keys = set(ReportCreate.model_fields.keys())
    prompt_keys = {f["key"] for f in REPORT_FIELDS}
    assert model_keys == prompt_keys, (
        f"ReportCreate keys != REPORT_FIELDS keys. "
        f"only_in_model={sorted(model_keys - prompt_keys)} "
        f"only_in_prompt={sorted(prompt_keys - model_keys)}"
    )


def test_report_fields_unique_keys():
    keys = [f["key"] for f in REPORT_FIELDS]
    assert len(keys) == len(set(keys)), "Duplicate keys in REPORT_FIELDS"


def test_chat_extraction_allowlist_matches_model():
    assert storage_mod._VALID_REPORT_FIELDS == frozenset(ReportCreate.model_fields.keys())
