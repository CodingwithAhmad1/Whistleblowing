# Backend Refactor Roadmap

**Scope:** Backend only. No frontend changes.  
**Goal:** Optimize logic, remove redundancy, ensure file continuity.

---

## Phase 1: Efficiency Audit Summary

### 1. Repeated Logic Identified

| Pattern | Files | Occurrences |
|---------|-------|-------------|
| Non-empty string check (`v and str(v).strip()`) | `prompts/core.py`, `prompts/layer1_classify.py`, `prompts/layer2_execute.py`, `storage.py`, `settings/store.py` | 6+ |
| API key validation + `genai.configure()` | `llm/gemini_provider.py`, `llm/registry.py`, `embeddings/service.py` | 3 |
| Question router try/except + fallback | `routers/questions.py` | 2 (q2, q3) |
| Session not-found → 404 | `routers/chat.py` | 2 (get_report, get_history) |
| Filled/unfilled field computation | `prompts/core.py`, `prompts/layer1_classify.py`, `prompts/layer2_execute.py` | 3 |

### 2. Optimization Wins

| Location | Issue | Impact |
|----------|-------|--------|
| `embeddings/store.py` | `search()` sorts all results then slices; use `heapq.nlargest` for O(n log k) | Low (small doc sets now) |
| `storage.py` | `person_fields` and `valid_fields` built on every `extract_json_from_response` call | Low |
| `settings/store.py` | `update_settings` calls `get_settings()` at end, re-reading file; could return merged dict | Low |
| `gemini_provider.py` | `self._client = None` in cleanup—`_client` never defined; dead code | Cleanup |

### 3. File Continuity

| Item | Status |
|------|--------|
| Logger pattern | ✅ Consistent (`logging.getLogger(__name__)`) |
| Import style | ✅ Relative imports used |
| Singleton getters | ✅ `get_provider`, `get_processor`, `get_settings`, etc. |
| `routers/__init__.py` | ⚠️ Empty; other packages export `__all__` |
| Dead code | ⚠️ `gemini_provider.cleanup()` sets `_client` which doesn't exist |

---

## Phase 2: Cleanup Roadmap (Proposed Optimizations)

### Optimization 1: Shared "non-empty value" helper

| Field | Value |
|-------|-------|
| **What** | Add `has_value(val)` and optionally `strip_or_none(val)` to `report_utils.py` (which already has `_non_empty`). Export and reuse across prompts, storage, settings. |
| **Files affected** | `app/question_processors/report_utils.py`, `app/prompts/core.py`, `app/prompts/layer1_classify.py`, `app/prompts/layer2_execute.py`, `app/storage.py`, `app/settings/store.py` |
| **Why** | Single place for "is this value present and non-empty?" logic. Reduces repeated `str(x).strip()` patterns; easier to adjust semantics later. |
| **Continuity** | Add `has_value(val: Any) -> bool` and keep `_non_empty` for string extraction. Update call sites to use helper. |

---

### Optimization 2: Shared Gemini/GenAI configuration

| Field | Value |
|-------|-------|
| **What** | Create `app/llm/genai_config.py` with `ensure_genai_configured()` that validates API key and calls `genai.configure()` once. `GeminiProvider` and `EmbeddingService` call it instead of duplicating logic. |
| **Files affected** | `app/llm/genai_config.py` (new), `app/llm/gemini_provider.py`, `app/llm/registry.py`, `app/embeddings/service.py` |
| **Why** | Avoids duplicate API key checks and `genai.configure()` calls; single source of truth for Gemini initialization. |
| **Continuity** | Keep `get_provider()` and `get_embedding_service()` as entry points; internal init delegates to shared helper. |

---

### Optimization 3: Factor question router into shared handler

| Field | Value |
|-------|-------|
| **What** | Replace duplicated `generate_q2`/`generate_q3` with a single `_generate_question(key: Literal["q2","q3"], body)` helper. Each route becomes a thin wrapper. |
| **Files affected** | `app/routers/questions.py` |
| **Why** | Reduces duplication; adding Q4+ later only requires one new route line. |
| **Continuity** | No renames; external API unchanged. |

---

### Optimization 4: Chat router session helper

| Field | Value |
|-------|-------|
| **What** | Add `_get_session_or_404(session_id: str) -> ChatSession` in `chat.py`. `get_report` and `get_history` use it instead of repeating the get + 404 logic. |
| **Files affected** | `app/routers/chat.py` |
| **Why** | DRY; consistent 404 handling; one place to change if session lookup evolves. |
| **Continuity** | No renames; internal only. |

---

### Optimization 5: Shared filled/unfilled helpers in prompts

| Field | Value |
|-------|-------|
| **What** | Add `get_filled_report_fields(report_data, keys=None)` and `get_unfilled_report_fields(...)` in `prompts/core.py` (or a new `prompts/field_utils.py`). Use in `build_system_prompt`, `layer1_classify`, `layer2_execute`. |
| **Files affected** | `app/prompts/core.py`, `app/prompts/layer1_classify.py`, `app/prompts/layer2_execute.py` |
| **Why** | Centralizes filled/unfilled logic; one definition of "has value" for report fields. |
| **Continuity** | Use `REPORT_FIELDS` from core; align on `has_value` from Optimization 1. |

---

### Optimization 6: Minor cleanups

| Field | Value |
|-------|-------|
| **What** | (a) Remove `self._client = None` from `gemini_provider.cleanup()`; (b) Make `person_fields` and `valid_fields` in `storage.py` module-level constants; (c) In `settings/store.py`, have `update_settings` return the merged dict directly instead of calling `get_settings()` again. |
| **Files affected** | `app/llm/gemini_provider.py`, `app/storage.py`, `app/settings/store.py` |
| **Why** | Removes dead code; avoids per-call set construction; avoids redundant file read. |
| **Continuity** | No API changes; internal only. |

---

### Optimization 7 (Optional): `heapq.nlargest` in embeddings store

| Field | Value |
|-------|-------|
| **What** | In `InMemoryDocumentStore.search()`, use `heapq.nlargest(top_k, results, key=lambda r: r.score)` instead of full sort + slice. |
| **Files affected** | `app/embeddings/store.py` |
| **Why** | O(n log k) vs O(n log n) when k << n. Low impact now; future-proof if doc count grows. |
| **Continuity** | No renames; same return shape. |

---

### Optimization 8 (Optional): Populate `routers/__init__.py`

| Field | Value |
|-------|-------|
| **What** | Add `__all__ = ["chat", "questions", "admin"]` or similar for consistency with other packages. |
| **Files affected** | `app/routers/__init__.py` |
| **Why** | Aligns with prompts, llm, question_processors, settings, embeddings which export public names. |
| **Continuity** | N/A. |

---

## Summary Table

| # | Optimization | Effort | Impact |
|---|--------------|--------|--------|
| 1 | Non-empty value helper | Medium | Medium |
| 2 | Shared GenAI config | Medium | Medium |
| 3 | Question router handler | Low | Low |
| 4 | Chat session helper | Low | Low |
| 5 | Filled/unfilled helpers | Medium | Medium |
| 6 | Minor cleanups | Low | Low |
| 7 | heapq in embeddings (optional) | Low | Low |
| 8 | routers __init__ (optional) | Trivial | Trivial |

---

**Recommendation:** Implement 1–6 for clear wins. 7 and 8 are optional polish.

**Approval required before Phase 3 (execution).**

---

## Phase 3: Execution (Completed)

All optimizations 1–8 have been implemented.
