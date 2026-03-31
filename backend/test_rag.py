"""Tests for the RAG policy quote pipeline — robustness and logical coherence."""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(__file__))


# ── Re-ranker tests ─────────────────────────────────────────────────────────

class TestRerankerFailClosed(unittest.TestCase):
    """Re-ranker should return empty list on LLM failure (not unfiltered candidates)."""

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_llm_exception_returns_empty(self, _mock_model, mock_client):
        """On any LLM exception, re-ranker fails closed (empty list)."""
        from app.rag.reranker import rerank_candidates

        mock_client.return_value.models.generate_content.side_effect = Exception("quota exhausted")

        candidates = [
            {"text": "Policy A", "metadata": {}, "similarity": 0.9},
            {"text": "Policy B", "metadata": {}, "similarity": 0.8},
        ]
        result = rerank_candidates("test query", candidates)
        self.assertEqual(result, [])

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_invalid_json_returns_empty(self, _mock_model, mock_client):
        """On invalid JSON from LLM, re-ranker fails closed."""
        from app.rag.reranker import rerank_candidates

        mock_response = MagicMock()
        mock_response.text = "not valid json at all"
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Policy A", "metadata": {}, "similarity": 0.9},
        ]
        result = rerank_candidates("test query", candidates)
        self.assertEqual(result, [])

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_unexpected_json_structure_returns_empty(self, _mock_model, mock_client):
        """On unexpected JSON structure, re-ranker fails closed."""
        from app.rag.reranker import rerank_candidates

        mock_response = MagicMock()
        mock_response.text = '"just a string"'
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Policy A", "metadata": {}, "similarity": 0.9},
        ]
        result = rerank_candidates("test query", candidates)
        self.assertEqual(result, [])


class TestRerankerScoring(unittest.TestCase):
    """Re-ranker correctly filters and sorts by relevance score."""

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_filters_below_threshold(self, _mock_model, mock_client):
        """Candidates scoring below MIN_RELEVANCE_SCORE (3) are excluded."""
        from app.rag.reranker import rerank_candidates
        import json

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "scores": [{"index": 0, "score": 4}, {"index": 1, "score": 2}],
            "best_quote": "Clean policy text here."
        })
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Relevant policy", "metadata": {"section_title": "Ethics"}, "similarity": 0.8},
            {"text": "Irrelevant text", "metadata": {}, "similarity": 0.7},
        ]
        result = rerank_candidates("harassment case", candidates)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["relevance_score"], 4)
        self.assertEqual(result[0]["clean_quote"], "Clean policy text here.")

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_all_below_threshold_returns_empty(self, _mock_model, mock_client):
        """If all candidates score below threshold, returns empty list."""
        from app.rag.reranker import rerank_candidates
        import json

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "scores": [{"index": 0, "score": 1}, {"index": 1, "score": 2}],
            "best_quote": None
        })
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Text A", "metadata": {}, "similarity": 0.8},
            {"text": "Text B", "metadata": {}, "similarity": 0.7},
        ]
        result = rerank_candidates("unrelated query", candidates)
        self.assertEqual(result, [])

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_old_format_still_works(self, _mock_model, mock_client):
        """Backwards-compatible with old array-only format (no best_quote)."""
        from app.rag.reranker import rerank_candidates
        import json

        mock_response = MagicMock()
        mock_response.text = json.dumps([
            {"index": 0, "score": 5}, {"index": 1, "score": 3}
        ])
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Policy A", "metadata": {}, "similarity": 0.9},
            {"text": "Policy B", "metadata": {}, "similarity": 0.7},
        ]
        result = rerank_candidates("query", candidates)

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["relevance_score"], 5)
        # No clean_quote attached when using old format
        self.assertNotIn("clean_quote", result[0])

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_markdown_wrapped_json(self, _mock_model, mock_client):
        """Handles markdown-wrapped JSON responses from LLM."""
        from app.rag.reranker import rerank_candidates
        import json

        inner = json.dumps({
            "scores": [{"index": 0, "score": 4}],
            "best_quote": "A policy statement."
        })
        mock_response = MagicMock()
        mock_response.text = f"```json\n{inner}\n```"
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Policy text", "metadata": {}, "similarity": 0.8},
        ]
        result = rerank_candidates("query", candidates)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["clean_quote"], "A policy statement.")


class TestRerankerSingleCandidate(unittest.TestCase):
    """Single-candidate no longer has special threshold logic."""

    @patch("app.rag.reranker.get_client")
    @patch("app.rag.reranker.get_active_model", return_value="test-model")
    def test_single_candidate_uses_llm(self, _mock_model, mock_client):
        """A single candidate goes through the same LLM scoring path."""
        from app.rag.reranker import rerank_candidates
        import json

        mock_response = MagicMock()
        mock_response.text = json.dumps({
            "scores": [{"index": 0, "score": 4}],
            "best_quote": "The policy states..."
        })
        mock_client.return_value.models.generate_content.return_value = mock_response

        candidates = [
            {"text": "Policy A", "metadata": {}, "similarity": 0.4},
        ]
        result = rerank_candidates("query", candidates)

        # Previously this would be rejected (similarity 0.4 < 0.5 hardcoded threshold)
        # Now it goes through LLM and passes with score 4
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["relevance_score"], 4)


class TestRerankerEmpty(unittest.TestCase):
    def test_empty_candidates(self):
        from app.rag.reranker import rerank_candidates
        self.assertEqual(rerank_candidates("query", []), [])


# ── Quote extractor tests ───────────────────────────────────────────────────

class TestQuoteExtractor(unittest.TestCase):

    @patch("app.rag.quote_extractor.get_client")
    @patch("app.rag.quote_extractor.get_active_model", return_value="test-model")
    def test_no_quote_returns_none(self, _mock_model, mock_client):
        """NO_QUOTE from LLM returns None, not raw garbage text."""
        from app.rag.quote_extractor import extract_clean_quote

        mock_response = MagicMock()
        mock_response.text = "NO_QUOTE"
        mock_client.return_value.models.generate_content.return_value = mock_response

        result = extract_clean_quote("query", "raw noisy PDF text with artifacts")
        self.assertIsNone(result)

    @patch("app.rag.quote_extractor.get_client")
    @patch("app.rag.quote_extractor.get_active_model", return_value="test-model")
    def test_empty_response_returns_none(self, _mock_model, mock_client):
        """Empty LLM response returns None."""
        from app.rag.quote_extractor import extract_clean_quote

        mock_response = MagicMock()
        mock_response.text = ""
        mock_client.return_value.models.generate_content.return_value = mock_response

        result = extract_clean_quote("query", "some text")
        self.assertIsNone(result)

    @patch("app.rag.quote_extractor.get_client")
    @patch("app.rag.quote_extractor.get_active_model", return_value="test-model")
    def test_exception_returns_none(self, _mock_model, mock_client):
        """LLM exception returns None, not raw text."""
        from app.rag.quote_extractor import extract_clean_quote

        mock_client.return_value.models.generate_content.side_effect = Exception("API error")

        result = extract_clean_quote("query", "some text")
        self.assertIsNone(result)

    @patch("app.rag.quote_extractor.get_client")
    @patch("app.rag.quote_extractor.get_active_model", return_value="test-model")
    def test_valid_quote_returned(self, _mock_model, mock_client):
        """Valid extracted quote is returned as-is."""
        from app.rag.quote_extractor import extract_clean_quote

        mock_response = MagicMock()
        mock_response.text = "Employees must report violations promptly."
        mock_client.return_value.models.generate_content.return_value = mock_response

        result = extract_clean_quote("query", "raw text")
        self.assertEqual(result, "Employees must report violations promptly.")


# ── Sentence builder tests ───────────────────────────────────────────────────

class TestSentenceBuilderFallback(unittest.TestCase):

    def test_naive_concatenation_uses_focused_fields(self):
        """Fallback uses 4 focused fields, not all 13."""
        from app.rag.sentence_builder import _naive_concatenation

        form_data = {
            "full_details_q1": "I saw fraud.",
            "general_nature": "Financial fraud",
            "where_occurred": "Office building",
            "when_occurred": "January 2026",
            "duration": "6 months",
            "how_aware": "Direct witness",
            "organization_tier": "Tier 1",
            "country": "UAE",
        }
        result = _naive_concatenation(form_data)

        # Should include the 4 focused fields
        self.assertIn("I saw fraud.", result)
        self.assertIn("Financial fraud", result)
        self.assertIn("Office building", result)

        # Should NOT include fields outside the 4 fallback keys
        self.assertNotIn("January 2026", result)
        self.assertNotIn("6 months", result)
        self.assertNotIn("Direct witness", result)

    def test_naive_concatenation_caps_length(self):
        """Fallback truncates at ~500 chars to prevent embedding quality degradation."""
        from app.rag.sentence_builder import _naive_concatenation

        form_data = {
            "full_details_q1": "A " * 300,  # 600 chars
        }
        result = _naive_concatenation(form_data)
        self.assertLessEqual(len(result), 500)

    def test_naive_concatenation_empty(self):
        from app.rag.sentence_builder import _naive_concatenation
        self.assertEqual(_naive_concatenation({}), "")


# ── format_section tests ────────────────────────────────────────────────────

class TestFormatSection(unittest.TestCase):
    def test_both_fields(self):
        from app.rag.reranker import format_section
        self.assertEqual(format_section({"section_title": "Ethics", "page": 5}), "Ethics — Page 5")

    def test_title_only(self):
        from app.rag.reranker import format_section
        self.assertEqual(format_section({"section_title": "Ethics"}), "Ethics")

    def test_page_only(self):
        from app.rag.reranker import format_section
        self.assertEqual(format_section({"page": 5}), "Page 5")

    def test_neither(self):
        from app.rag.reranker import format_section
        self.assertEqual(format_section({}), "Unknown section")


# ── Service integration tests (mocked ChromaDB + LLM) ───────────────────────

class TestServiceQuery(unittest.TestCase):
    """Integration tests for PolicyRAGService.query()."""

    def _make_service_with_candidates(self, candidates_data):
        """Helper: create a service with mocked ChromaDB returning given candidates."""
        from app.rag.service import PolicyRAGService

        service = PolicyRAGService()
        service._available = True

        mock_collection = MagicMock()
        mock_collection.query.return_value = {
            "documents": [[c["text"] for c in candidates_data]],
            "distances": [[1.0 - c["similarity"] for c in candidates_data]],
            "metadatas": [[c.get("metadata", {}) for c in candidates_data]],
        }
        service._collection = mock_collection
        return service

    @patch("app.rag.service.rerank_candidates")
    @patch("app.embeddings.service.get_embedding_service")
    def test_clean_quote_from_reranker_skips_extractor(self, mock_embed, mock_rerank):
        """When re-ranker provides clean_quote, no extra LLM call needed."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        candidates = [{"text": "raw text", "metadata": {"section_title": "Ethics", "page": 3}, "similarity": 0.8}]
        service = self._make_service_with_candidates(candidates)

        mock_rerank.return_value = [{
            "text": "raw text",
            "metadata": {"section_title": "Ethics", "page": 3},
            "similarity": 0.8,
            "relevance_score": 4,
            "clean_quote": "Employees must report violations.",
        }]

        result = service.query("harassment case")

        self.assertIsNotNone(result)
        self.assertEqual(result["quote"], "Employees must report violations.")
        self.assertEqual(result["section"], "Ethics — Page 3")

    @patch("app.rag.service.extract_clean_quote")
    @patch("app.rag.service.rerank_candidates")
    @patch("app.embeddings.service.get_embedding_service")
    def test_falls_back_to_extractor_when_no_inline_quote(self, mock_embed, mock_rerank, mock_extract):
        """When re-ranker has no clean_quote, falls back to quote extractor."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        candidates = [{"text": "raw text", "metadata": {}, "similarity": 0.8}]
        service = self._make_service_with_candidates(candidates)

        mock_rerank.return_value = [{
            "text": "raw text",
            "metadata": {},
            "similarity": 0.8,
            "relevance_score": 4,
            # No clean_quote
        }]
        mock_extract.return_value = "Extracted quote from fallback."

        result = service.query("query")
        self.assertEqual(result["quote"], "Extracted quote from fallback.")

    @patch("app.rag.service.extract_clean_quote")
    @patch("app.rag.service.rerank_candidates")
    @patch("app.embeddings.service.get_embedding_service")
    def test_iterates_candidates_on_extraction_failure(self, mock_embed, mock_rerank, mock_extract):
        """If first candidate's quote extraction fails (None), tries the next one."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        candidates = [
            {"text": "noisy text", "metadata": {"page": 1}, "similarity": 0.9},
            {"text": "clean text", "metadata": {"page": 2}, "similarity": 0.8},
        ]
        service = self._make_service_with_candidates(candidates)

        mock_rerank.return_value = [
            {"text": "noisy text", "metadata": {"page": 1}, "similarity": 0.9, "relevance_score": 5},
            {"text": "clean text", "metadata": {"page": 2}, "similarity": 0.8, "relevance_score": 4},
        ]
        # First candidate returns None (garbage), second succeeds
        mock_extract.side_effect = [None, "A valid policy statement."]

        result = service.query("query")
        self.assertEqual(result["quote"], "A valid policy statement.")
        self.assertEqual(result["section"], "Page 2")

    @patch("app.rag.service.extract_clean_quote")
    @patch("app.rag.service.rerank_candidates")
    @patch("app.embeddings.service.get_embedding_service")
    def test_all_candidates_fail_returns_none(self, mock_embed, mock_rerank, mock_extract):
        """If all candidates produce no usable quote, returns None."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        candidates = [{"text": "noise", "metadata": {}, "similarity": 0.8}]
        service = self._make_service_with_candidates(candidates)

        mock_rerank.return_value = [
            {"text": "noise", "metadata": {}, "similarity": 0.8, "relevance_score": 3},
        ]
        mock_extract.return_value = None

        result = service.query("query")
        self.assertIsNone(result)

    @patch("app.rag.service.rerank_candidates")
    @patch("app.embeddings.service.get_embedding_service")
    def test_reranker_failure_returns_none(self, mock_embed, mock_rerank):
        """When re-ranker fails closed (returns []), service returns None."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        candidates = [{"text": "text", "metadata": {}, "similarity": 0.8}]
        service = self._make_service_with_candidates(candidates)

        mock_rerank.return_value = []  # Fail closed

        result = service.query("query")
        self.assertIsNone(result)

    @patch("app.embeddings.service.get_embedding_service")
    def test_similarity_clamped_to_zero(self, mock_embed):
        """Negative similarity values (distance > 1.0) are clamped to 0."""
        mock_embed.return_value.embed_text.return_value = [0.1] * 768

        from app.rag.service import PolicyRAGService
        service = PolicyRAGService()
        service._available = True

        mock_collection = MagicMock()
        mock_collection.query.return_value = {
            "documents": [["some text"]],
            "distances": [[1.5]],  # distance > 1.0 → would be negative similarity
            "metadatas": [[{}]],
        }
        service._collection = mock_collection

        result = service.query("query")
        # Similarity 0.0 < 0.3 threshold → no candidates → None
        self.assertIsNone(result)


# ── Runner ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromModule(sys.modules[__name__])
    results = {"passed": 0, "failed": 0, "errors": 0, "skipped": 0}

    class CountingResult(unittest.TextTestResult):
        def addSuccess(self, test):
            super().addSuccess(test)
            results["passed"] += 1
        def addFailure(self, test, err):
            super().addFailure(test, err)
            results["failed"] += 1
        def addError(self, test, err):
            super().addError(test, err)
            results["errors"] += 1
        def addSkip(self, test, reason):
            super().addSkip(test, reason)
            results["skipped"] += 1

    runner = unittest.TextTestRunner(resultclass=CountingResult, verbosity=2)
    runner.run(suite)

    total_fail = results["failed"] + results["errors"]
    print(f"\n{'─' * 50}")
    print(f"Results: {results['passed']} passed, {total_fail} failed, {results['skipped']} skipped")
    if total_fail == 0:
        print("\n✓ All tests passed.")
    else:
        print(f"\n✗ {total_fail} test(s) failed.")
        sys.exit(1)
