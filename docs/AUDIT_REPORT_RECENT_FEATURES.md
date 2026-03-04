# Functional & Integration Audit — Recently Implemented Features

**Scope:** Stored API key, Q2/Q3 prompt templates, Admin page changes, Full Details flow.  
**Phase 1–2 Complete.** No fixes applied until approved.

---

## Phase 1: Blast Radius

### Files Modified (Recent Implementation)

| File | Consumers / Dependents |
|------|------------------------|
| `backend/app/llm/genai_config.py` | registry, gemini_provider, embeddings/service |
| `backend/app/llm/registry.py` | main, chat router, q2_processor, q3_processor |
| `backend/app/prompts/display_content.py` | settings/store (indirect), q2_processor, q3_processor |
| `backend/app/settings/store.py` | admin router, registry, q2_processor, q3_processor |
| `backend/app/routers/admin.py` | main |
| `backend/app/question_processors/q2_processor.py` | questions router |
| `backend/app/question_processors/q3_processor.py` | questions router |
| `frontend/src/pages/AdminPage.tsx` | App (route) |
| `frontend/src/hooks/useQuestionContent.ts` | FullDetailsQuestionnaire |
| `frontend/src/components/ReportPanel/sections/FullDetailsQuestionnaire.tsx` | ReportPanel → Incident |

### Cross-File Dependency Chain

```
AdminPage → GET/PUT /api/admin/settings → admin router → get_settings/update_settings
useQuestionContent → POST /api/questions/q2|q3/generate → questions router → Q2Processor | Q3Processor
Q2Processor, Q3Processor → get_provider() → registry → ensure_genai_configured(api_key)
registry → get_settings() ["apiKey"] → settings store
EmbeddingService._ensure_initialized() → ensure_genai_configured() [no args] → uses env only
```

---

## Phase 2: Problem & Solution Report

### Issue 1: [embeddings/service.py — State Desync]

- **Problem:** `EmbeddingService` calls `ensure_genai_configured()` with no arguments. That path uses `settings.GEMINI_API_KEY` from env and ignores the stored `apiKey`. If an Admin stores an API key, chat and Q2/Q3 use it, but embeddings would still use env. Inconsistent behavior once embeddings are used.
- **Root Cause:** `ensure_genai_configured()` with `api_key=None` resolves to env. `EmbeddingService` never passes the stored key (line 23).
- **Recommendation:** In `_ensure_initialized()`, resolve key like registry:  
  `api_key = get_settings().get("apiKey") or None` then `ensure_genai_configured(api_key)`.

---

### Issue 2: [q2_processor.py, q3_processor.py — Silent Failure]

- **Problem:** If Admin enters a custom prompt template with an invalid placeholder (e.g. `{typo}` or `{unknown}`), `template.format(context=..., word_limit=...)` raises `KeyError`. The broad `except Exception` catches it, logs a warning, and returns fallback. The user gets fallback output with no indication their template is invalid.
- **Root Cause:** No validation of template placeholders before `format()` (q2 line 27, q3 line 29).
- **Recommendation:** Either (a) catch `KeyError` separately, log with `logger.warning("Invalid placeholder in prompt template")`, and return fallback, or (b) validate that the template only uses `{context}` and `{word_limit}` before calling `format()`, and return a clear error to the API response (e.g. 400 with message) instead of falling back silently.

---

### Issue 3: [reportSchema.ts — Continuity Break]

- **Problem:** `REPORT_FIELDS` labels `full_details_q2` as `"AI Generated - Coming soon"`. The field now stores the **user's answer** to the AI-generated question, not AI content. The PDF will show that label above the user’s answer, which is misleading.
- **Root Cause:** Schema was written when `full_details_q2` was meant to hold AI content. Implementation changed so Q2 content is the question (label) and the textarea value is the answer.
- **Recommendation:** Update the label, e.g. to `"Your answer to the follow-up question"` or a similar neutral label that reflects that it is the user’s response. Optionally derive the label from the Q2 question at export time if the schema supports it.

---

### Issue 4: [genai_config.py — Testability]

- **Problem:** `reset_provider()` in registry clears the provider but `_last_configured_key` in `genai_config` is never reset. Tests that change the API key (env or stored) may not see the new key applied because `ensure_genai_configured` skips when `_last_configured_key == resolved` and the previous key may still be cached.
- **Root Cause:** No `reset_genai_config()` or equivalent to clear `_last_configured_key`.
- **Recommendation:** Add `reset_genai_config()` in `genai_config.py` that sets `_last_configured_key = None`. Call it from `reset_provider()` (or document it for tests). Low urgency if no tests rely on key switching.

---

### Issue 5: [AdminPage.tsx — Backward Compatibility]

- **Problem:** If the backend returns a settings object without `q2PromptTemplate` or `q3PromptTemplate` (e.g. pre-upgrade `settings.json` or a different API version), `data?.q2PromptTemplate` and `data?.q3PromptTemplate` are undefined. The `?? ''` fallback handles this, so load works. Save sends all four fields; if the backend accepts unknown keys gracefully, this is fine. No critical bug, but worth noting.
- **Root Cause:** N/A — current code is defensive.
- **Recommendation:** No change required. Optional: document that new keys are additive and that empty/missing values default correctly.

---

### Issue 6: [FullDetailsQuestionnaire.tsx — Edge Case]

- **Problem:** In review mode, Q2 label uses `q2.data?.content ?? q.label`. If the user reaches review by some path where step 2 was never visited (e.g. future "Skip to review" or deep link), `q2.data` is null and the fallback `"AI Generated"` is shown. Current flow requires step 2 before Done, so this is theoretical.
- **Root Cause:** `useQuestionContent('q2', report, step)` does not fetch when `step === 3`.
- **Recommendation:** No immediate fix. If a "skip" or alternate path is added later, consider fetching Q2 when entering review mode or storing the Q2 question in report context when step 2 is completed.

---

## Summary Table

| ID | Severity | Category       | File(s)                          |
|----|----------|----------------|----------------------------------|
| 1  | Medium   | State Desync   | embeddings/service.py           |
| 2  | Medium   | Silent Failure | q2_processor, q3_processor       |
| 3  | Low      | Continuity     | reportSchema.ts                  |
| 4  | Low      | Testability    | genai_config, registry           |
| 5  | —        | Info           | AdminPage (no action needed)     |
| 6  | Low      | Edge Case      | FullDetailsQuestionnaire (future)|

---

## Logic & Performance Notes

- **No O(n²) or redundant API calls** in the modified paths.
- **Cache invalidation:** Q2 and Q3 cache keys include `settingsModified`; Admin saves correctly invalidate both.
- **AI timing:** Fetch occurs only when `step === 2` (Q2) or `step === 3` (Q3), so AI is invoked only after the user clicks Next.

---

## Phase 3: Fixes Applied

| ID | Fix |
|----|-----|
| 1 | `EmbeddingService._ensure_initialized()` now passes `get_settings().get("apiKey")` to `ensure_genai_configured()` |
| 2 | Q2/Q3 processors catch `KeyError` from template format; log warning and return fallback |
| 3 | `reportSchema.ts` full_details_q2 label updated to "Your answer to the follow-up question" |
| 4 | Added `reset_genai_config()` in genai_config; `reset_provider()` calls it |
