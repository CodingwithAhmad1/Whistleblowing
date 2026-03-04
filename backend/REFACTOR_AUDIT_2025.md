# Backend Refactor Audit — Phase 1 & 2

**Date:** March 1, 2025  
**Scope:** Backend only. No frontend changes.  
**Goal:** Optimize logic, remove redundancy, ensure file continuity.

---

## Phase 1: Efficiency Audit

### 1. Repeated Logic Identified

| Pattern | Files | Notes |
|---------|-------|-------|
| `_truncate_to_words(text, max_words)` | `q2_processor.py`, `q3_processor.py` | **Identical implementation** (lines 35–38 / 37–40) |
| `_get_prompt_template()` | `q2_processor.py`, `q3_processor.py` | **Same pattern**, different setting key and default |
| `(content or "").strip().split("\n")[0]` | `q2_processor.py`, `q3_processor.py` | **Identical first-line extraction** for LLM output |
| `api_key = get_settings().get("apiKey") or None` + `ensure_genai_configured(api_key)` | `llm/registry.py`, `embeddings/service.py` | Same 2-line init pattern |
| `_build_q2_prompt` / `_build_q3_prompt` | `q2_processor.py`, `q3_processor.py` | Same structure: get context → get template → format → KeyError handling |

### 2. Optimization Wins

| Location | Issue | Impact |
|----------|-------|--------|
| `q2_processor.py`, `q3_processor.py` | `_truncate_to_words` duplicated | Low — move to shared util |
| `q2_processor.py`, `q3_processor.py` | First-line extraction + truncation repeated | Low — small helper `_first_line_and_truncate` or inline in shared util |
| `report_utils.py` | `extract_incident_query` hardcodes `["full_details_q1", "general_nature", "where_occurred"]` while `extract_incident_parts` uses `INCIDENT_CONTEXT_KEYS` | Continuity — use a constant for consistency |
| `EmbeddingService.embed_documents` | `[self.embed_text(t) for t in texts]` — sequential; Gemini API supports batch | Low — batch embedding if API supports it; verify first |
| `admin.py` | `if "policyExcerpt" in body: updates["policyExcerpt"] = ...` repeated 4× | Low — could iterate over keys; current is explicit and readable |

### 3. File Continuity

| Item | Status |
|------|--------|
| Logger pattern | ✅ Consistent (`logging.getLogger(__name__)`) |
| Import style | ✅ Relative imports used |
| Singleton getters | ✅ `get_provider`, `get_processor`, `get_settings`, `get_embedding_service` |
| `routers/__init__.py` | ✅ Populated with `__all__` |
| `report_utils.py` | ⚠️ `extract_incident_query` uses hardcoded keys; `extract_incident_parts` uses `INCIDENT_CONTEXT_KEYS` |
| Q2/Q3 processors | ⚠️ Duplicate `_truncate_to_words`, `_get_prompt_template`, similar `_build_*_prompt` |

---

## Phase 2: Cleanup Roadmap (Proposed Optimizations)

**STOP — Pending your approval before Phase 3 execution.**

---

### Optimization 1: Shared `truncate_to_words` and first-line extraction

| Field | Value |
|-------|-------|
| **What** | Add `truncate_to_words(text, max_words)` and `first_line(text)` to `report_utils.py`. Remove duplicates from q2 and q3 processors. |
| **Files affected** | `app/question_processors/report_utils.py`, `app/question_processors/q2_processor.py`, `app/question_processors/q3_processor.py` |
| **Why** | Single source for text truncation; easier to adjust behavior (e.g., word-boundary handling) later. |
| **Continuity** | Export from `report_utils`; processors import `truncate_to_words` and optionally `first_line` (or keep inline if trivial). |

---

### Optimization 2: Shared "stored prompt template" helper

| Field | Value |
|-------|-------|
| **What** | Add `get_stored_prompt_template(setting_key: str, default: str) -> str` in `report_utils.py` or new `prompts/template_utils.py`. Replace `_get_prompt_template()` in q2 and q3 with calls like `get_stored_prompt_template("q2PromptTemplate", DEFAULT_Q2_PROMPT_TEMPLATE)`. |
| **Files affected** | `app/question_processors/report_utils.py` (or `app/prompts/template_utils.py`), `app/question_processors/q2_processor.py`, `app/question_processors/q3_processor.py` |
| **Why** | One implementation for "stored or default template"; adding Q4+ only needs a new call. |
| **Continuity** | Remove local `_get_prompt_template()` from both processors. |

---

### Optimization 3: Optional — Generic template prompt builder

| Field | Value |
|-------|-------|
| **What** | Add `build_template_prompt(context: str, word_limit: int, setting_key: str, default_template: str) -> str` that gets template, formats with `{context}` and `{word_limit}`, handles KeyError. `_build_q2_prompt` and `_build_q3_prompt` become thin wrappers that extract context and call it. |
| **Files affected** | `app/question_processors/report_utils.py` or `app/prompts/template_utils.py`, `q2_processor.py`, `q3_processor.py` |
| **Why** | Reduces duplication of format + KeyError logic. |
| **Continuity** | Keep `_build_q2_prompt` and `_build_q3_prompt` as thin wrappers; internal only. |
| **Note** | Lower priority; Optimization 1–2 give most of the benefit. |

---

### Optimization 4: `INCIDENT_QUERY_KEYS` constant in report_utils

| Field | Value |
|-------|-------|
| **What** | Add `INCIDENT_QUERY_KEYS = ["full_details_q1", "general_nature", "where_occurred"]` and use it in `extract_incident_query()`. Documents that Q3 query uses a subset of `INCIDENT_CONTEXT_KEYS`. |
| **Files affected** | `app/question_processors/report_utils.py` |
| **Why** | Consistent with `INCIDENT_CONTEXT_KEYS`; avoids magic strings. |
| **Continuity** | No API changes; internal constant only. |

---

### Optimization 5: Optional — Centralize "ensure GenAI from settings"

| Field | Value |
|-------|-------|
| **What** | Add `ensure_genai_from_settings() -> None` in `genai_config.py` that does `get_settings().get("apiKey") or None` + `ensure_genai_configured(api_key)`. Use in `registry.get_provider()` and `EmbeddingService._ensure_initialized()`. |
| **Files affected** | `app/llm/genai_config.py`, `app/llm/registry.py`, `app/embeddings/service.py` |
| **Why** | One-line call instead of two; single place if settings source changes. |
| **Continuity** | No external API changes. |
| **Note** | Low impact; optional polish. |

---

### Optimization 6: Optional — Admin router key iteration

| Field | Value |
|-------|-------|
| **What** | Replace repetitive `if "policyExcerpt" in body: updates[...] = ...` with a loop over `["policyExcerpt", "apiKey", "q2PromptTemplate", "q3PromptTemplate"]`. |
| **Files affected** | `app/routers/admin.py` |
| **Why** | Slightly less code; adding a new setting key is one line. |
| **Continuity** | No API changes. |
| **Note** | Current explicit blocks are clear; optional. |

---

## Summary Table

| # | Optimization | Effort | Impact |
|---|--------------|--------|--------|
| 1 | Shared `truncate_to_words` + `first_line` | Low | Medium (DRY) |
| 2 | Shared `get_stored_prompt_template` | Low | Medium (DRY) |
| 3 | Generic template prompt builder (optional) | Medium | Low |
| 4 | `INCIDENT_QUERY_KEYS` constant | Trivial | Low (continuity) |
| 5 | `ensure_genai_from_settings` (optional) | Low | Low |
| 6 | Admin key iteration (optional) | Low | Low |

---

## Recommendation

**Implement 1, 2, and 4** for clear DRY and continuity wins with minimal risk.  
**Consider 3** if you expect more Q-style processors soon.  
**Skip 5 and 6** unless you want extra polish.

---

**Approval required before Phase 3 (execution).**
