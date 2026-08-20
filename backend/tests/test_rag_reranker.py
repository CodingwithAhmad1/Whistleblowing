"""Tests for the RAG re-ranker and quote extractor (fully mocked, no network).

Ported from the former backend/test_rag.py and updated to the index-bound
best_quote contract: the LLM returns {"index", "text"}, the quote is attached
to the candidate it was copied from, and it must be verbatim in that candidate.
"""

import json
from unittest.mock import MagicMock, patch

from app.rag.reranker import format_section, rerank_candidates


def _mock_llm(mock_client, payload):
    response = MagicMock()
    response.text = payload if isinstance(payload, str) else json.dumps(payload)
    mock_client.return_value.models.generate_content.return_value = response


# ── Fail closed: LLM failure is "unavailable" (None), never "no match" ([]) ──


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_llm_exception_returns_none(_mock_model, mock_client):
    mock_client.return_value.models.generate_content.side_effect = Exception("quota exhausted")
    candidates = [
        {"text": "Policy A", "metadata": {}, "similarity": 0.9},
        {"text": "Policy B", "metadata": {}, "similarity": 0.8},
    ]
    assert rerank_candidates("test query", candidates) is None


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_invalid_json_returns_none(_mock_model, mock_client):
    _mock_llm(mock_client, "not valid json at all")
    candidates = [{"text": "Policy A", "metadata": {}, "similarity": 0.9}]
    assert rerank_candidates("test query", candidates) is None


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_unexpected_json_structure_returns_none(_mock_model, mock_client):
    _mock_llm(mock_client, '"just a string"')
    candidates = [{"text": "Policy A", "metadata": {}, "similarity": 0.9}]
    assert rerank_candidates("test query", candidates) is None


def test_empty_candidates():
    assert rerank_candidates("query", []) == []


# ── Scoring, filtering, quote binding ────────────────────────────────────────


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_filters_below_threshold_and_attaches_quote(_mock_model, mock_client):
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 4}, {"index": 1, "score": 2}],
        "best_quote": {"index": 0, "text": "report violations promptly"},
    })
    candidates = [
        {"text": "Staff must report violations promptly.", "metadata": {"section_title": "Ethics"}, "similarity": 0.8},
        {"text": "Irrelevant text", "metadata": {}, "similarity": 0.7},
    ]
    result = rerank_candidates("harassment case", candidates)
    assert len(result) == 1
    assert result[0]["relevance_score"] == 4
    assert result[0]["clean_quote"] == "report violations promptly"


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_quote_bound_to_its_candidate_not_rank_position(_mock_model, mock_client):
    """The regression this contract exists for: the quote must carry the metadata
    of the candidate it came from, even when another candidate ranks first."""
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 4}, {"index": 1, "score": 5}],
        "best_quote": {"index": 0, "text": "bribery is prohibited"},
    })
    candidates = [
        {"text": "All forms of bribery is prohibited here.", "metadata": {"page": "10"}, "similarity": 0.8},
        {"text": "Unrelated but highly scored text.", "metadata": {"page": "99"}, "similarity": 0.9},
    ]
    result = rerank_candidates("bribery case", candidates)
    assert len(result) == 2
    # Sorted by score: index 1 first, index 0 second — quote sits on index 0.
    assert result[0]["candidate_index"] == 1
    assert "clean_quote" not in result[0]
    assert result[1]["candidate_index"] == 0
    assert result[1]["clean_quote"] == "bribery is prohibited"


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_non_verbatim_quote_discarded(_mock_model, mock_client):
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 5}],
        "best_quote": {"index": 0, "text": "A paraphrase that appears nowhere."},
    })
    candidates = [{"text": "The actual policy text.", "metadata": {}, "similarity": 0.8}]
    result = rerank_candidates("query", candidates)
    assert len(result) == 1
    assert "clean_quote" not in result[0]


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_quote_index_outside_relevant_discarded(_mock_model, mock_client):
    """Quote attributed to a candidate that fell below the score threshold is dropped."""
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 4}, {"index": 1, "score": 1}],
        "best_quote": {"index": 1, "text": "Low scoring text."},
    })
    candidates = [
        {"text": "Good candidate.", "metadata": {}, "similarity": 0.8},
        {"text": "Low scoring text.", "metadata": {}, "similarity": 0.5},
    ]
    result = rerank_candidates("query", candidates)
    assert len(result) == 1
    assert "clean_quote" not in result[0]


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_all_below_threshold_returns_empty(_mock_model, mock_client):
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 1}, {"index": 1, "score": 2}],
        "best_quote": None,
    })
    candidates = [
        {"text": "Text A", "metadata": {}, "similarity": 0.8},
        {"text": "Text B", "metadata": {}, "similarity": 0.7},
    ]
    assert rerank_candidates("unrelated query", candidates) == []


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_legacy_array_format_still_works(_mock_model, mock_client):
    _mock_llm(mock_client, [{"index": 0, "score": 5}, {"index": 1, "score": 3}])
    candidates = [
        {"text": "Policy A", "metadata": {}, "similarity": 0.9},
        {"text": "Policy B", "metadata": {}, "similarity": 0.7},
    ]
    result = rerank_candidates("query", candidates)
    assert len(result) == 2
    assert result[0]["relevance_score"] == 5
    assert "clean_quote" not in result[0]


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_legacy_string_quote_attributed_by_verbatim_match(_mock_model, mock_client):
    """Old-format string best_quote is only attached when exactly one candidate contains it."""
    _mock_llm(mock_client, {
        "scores": [{"index": 0, "score": 4}, {"index": 1, "score": 3}],
        "best_quote": "unique verbatim fragment",
    })
    candidates = [
        {"text": "Contains the unique verbatim fragment here.", "metadata": {}, "similarity": 0.8},
        {"text": "Different content entirely.", "metadata": {}, "similarity": 0.7},
    ]
    result = rerank_candidates("query", candidates)
    owner = next(c for c in result if c["candidate_index"] == 0)
    other = next(c for c in result if c["candidate_index"] == 1)
    assert owner["clean_quote"] == "unique verbatim fragment"
    assert "clean_quote" not in other


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_markdown_wrapped_json(_mock_model, mock_client):
    inner = json.dumps({
        "scores": [{"index": 0, "score": 4}],
        "best_quote": {"index": 0, "text": "A policy statement."},
    })
    _mock_llm(mock_client, f"```json\n{inner}\n```")
    candidates = [{"text": "Preamble. A policy statement. Coda.", "metadata": {}, "similarity": 0.8}]
    result = rerank_candidates("query", candidates)
    assert len(result) == 1
    assert result[0]["clean_quote"] == "A policy statement."


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_full_candidate_text_sent_to_prompt(_mock_model, mock_client):
    """Chunks are no longer truncated to 500 chars before ranking."""
    _mock_llm(mock_client, {"scores": [{"index": 0, "score": 3}], "best_quote": None})
    long_text = "Sentence about compliance. " * 60  # ~1600 chars
    rerank_candidates("query", [{"text": long_text, "metadata": {}, "similarity": 0.8}])
    prompt_sent = mock_client.return_value.models.generate_content.call_args.kwargs["contents"]
    assert long_text in prompt_sent


# ── Quote extractor ──────────────────────────────────────────────────────────


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_extractor_no_quote_returns_none(_mock_model, mock_client):
    from app.rag.quote_extractor import extract_clean_quote
    _mock_llm(mock_client, "NO_QUOTE")
    assert extract_clean_quote("query", "raw noisy PDF text") is None


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_extractor_empty_response_returns_none(_mock_model, mock_client):
    from app.rag.quote_extractor import extract_clean_quote
    _mock_llm(mock_client, "")
    assert extract_clean_quote("query", "some text") is None


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_extractor_exception_returns_none(_mock_model, mock_client):
    from app.rag.quote_extractor import extract_clean_quote
    mock_client.return_value.models.generate_content.side_effect = Exception("API error")
    assert extract_clean_quote("query", "some text") is None


@patch("app.llm.generate.get_client")
@patch("app.llm.generate.get_active_model", return_value="gemini-2.0-flash")
def test_extractor_valid_quote_returned(_mock_model, mock_client):
    from app.rag.quote_extractor import extract_clean_quote
    _mock_llm(mock_client, "Employees must report violations promptly.")
    assert (
        extract_clean_quote("query", "raw text")
        == "Employees must report violations promptly."
    )


# ── Sentence builder fallback ────────────────────────────────────────────────


def test_naive_concatenation_uses_focused_fields():
    from app.rag.sentence_builder import _naive_concatenation

    form_data = {
        "full_details_q1": "I saw fraud.",
        "general_nature": "Financial fraud",
        "where_occurred": "Office building",
        "when_occurred": "January 2026",
        "duration": "6 months",
        "how_aware": "Direct witness",
    }
    result = _naive_concatenation(form_data)
    assert "I saw fraud." in result
    assert "Financial fraud" in result
    assert "Office building" in result
    assert "January 2026" not in result
    assert "6 months" not in result


def test_naive_concatenation_caps_length():
    from app.rag.sentence_builder import _naive_concatenation
    assert len(_naive_concatenation({"full_details_q1": "A " * 300})) <= 500


def test_naive_concatenation_empty():
    from app.rag.sentence_builder import _naive_concatenation
    assert _naive_concatenation({}) == ""


# ── format_section ───────────────────────────────────────────────────────────


def test_format_section_both_fields():
    assert format_section({"section_title": "Ethics", "page": 5}) == "Ethics — Page 5"


def test_format_section_title_only():
    assert format_section({"section_title": "Ethics"}) == "Ethics"


def test_format_section_page_only():
    assert format_section({"page": 5}) == "Page 5"


def test_format_section_article():
    assert format_section({"section_title": "Protection", "article": "Article 19"}) == (
        "Protection — Article 19"
    )


def test_format_section_neither():
    assert format_section({}) == "Unknown section"
