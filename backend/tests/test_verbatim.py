"""Tests for serialization-layer verbatim-quote enforcement (app/rag/verbatim.py)."""

from app.rag.verbatim import find_verbatim_span, is_verbatim, normalize


class TestNormalize:
    def test_collapses_whitespace(self):
        assert normalize("a  b\n\nc\t d") == "a b c d"

    def test_maps_typographic_chars(self):
        assert normalize("“It’s fine” — really") == "\"It's fine\" - really"


class TestIsVerbatim:
    SOURCE = (
        "[Speak Up]\n\nEmployees must report suspected violations promptly.\n"
        "Retaliation against anyone who raises a concern is strictly prohibited."
    )

    def test_exact_substring(self):
        assert is_verbatim("Employees must report suspected violations promptly.", self.SOURCE)

    def test_whitespace_differences(self):
        assert is_verbatim(
            "violations promptly. Retaliation against anyone", self.SOURCE
        )

    def test_typographic_quote_differences(self):
        source = "The company’s policy is clear."
        assert is_verbatim("The company's policy is clear.", source)

    def test_paraphrase_rejected(self):
        assert not is_verbatim("Workers should tell someone about problems.", self.SOURCE)

    def test_merged_passages_rejected(self):
        # Non-contiguous splice of two real fragments is not verbatim.
        assert not is_verbatim(
            "Employees must report is strictly prohibited", self.SOURCE
        )

    def test_empty_inputs(self):
        assert not is_verbatim("", self.SOURCE)
        assert not is_verbatim("anything", "")


class TestFindVerbatimSpan:
    def test_exact_offsets(self):
        source = "Alpha beta gamma delta."
        span = find_verbatim_span("beta gamma", source)
        assert span is not None
        start, end = span
        assert source[start:end] == "beta gamma"

    def test_offsets_survive_whitespace_normalization(self):
        source = "Alpha  beta\n gamma delta."
        span = find_verbatim_span("beta gamma", source)
        assert span is not None
        start, end = span
        assert source[start:end] == "beta\n gamma"

    def test_no_match_returns_none(self):
        assert find_verbatim_span("epsilon", "Alpha beta") is None

    def test_case_insensitive(self):
        span = find_verbatim_span("ALPHA BETA", "alpha beta gamma")
        assert span == (0, 10)
