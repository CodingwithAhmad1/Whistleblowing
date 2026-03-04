# Documentation Update Plan — March 2025

**Phase 1: Location Discovery ✅**

**Central documentation folder:** `/docs`

---

## Phase 2: Audit & Gap Analysis

### Outdated Information

| Doc | Issue | Current Code |
|-----|-------|--------------|
| **ARCHITECTURE.md** | Full Details Q2: "AI-generated 2–3 sentence summary" | Q2 generates a **~10-word follow-up question** via LLM (see `display_content.py` DEFAULT_Q2_PROMPT_TEMPLATE) |
| **ARCHITECTURE.md** | Settings Store keys: "policyExcerpt, apiKey" only | Also: `q2PromptTemplate`, `q3PromptTemplate` |
| **ARCHITECTURE.md** | report_utils.py: "has_value(), extract_incident_parts(), extract_incident_query()" | After refactor: also `first_line()`, `truncate_to_words()`, `get_stored_prompt_template()`, `INCIDENT_QUERY_KEYS` |
| **api/README.md** | Q2: "Generate a 2–3 sentence AI summary" | Q2 generates a **short question** (10 words); response shape `{content: "..."}` is the question text |
| **api/README.md** | Admin GET response shows only policyExcerpt, apiKey | Response includes `q2PromptTemplate`, `q3PromptTemplate` |
| **api/README.md** | apiKey: "Reserved for future use" | **Stored apiKey is used** — primary source for Gemini; env GEMINI_API_KEY is fallback |
| **api/README.md** | Q3: "Uses embeddings (when docs exist) or falls back" | Q3 uses **LLM to generate policy excerpt** first; falls back to settings only when LLM fails. Embeddings (`policy_quoting`) returns `[]` — not used for Q3 yet |
| **guides/admin-guide.md** | API Key: "Reserved for future use... not used" | **Incorrect** — API key is the main Gemini credential; stored in Admin, used by chat/Q2/Q3/embeddings |
| **guides/admin-guide.md** | Only documents Policy Excerpt and API Key | Missing: **Q2 Prompt Template**, **Q3 Prompt Template** (admin-editable LLM prompts) |
| **guides/user-guide.md** | Q2: "AI-generated 2–3 sentence summary" | Q2 is an **AI-generated follow-up question** (~10 words) |
| **testing/README.md** | "Q2 (AI summary)" | Q2 is a **short question**; curl example comment should say "Q2 — short question" |
| **SETUP.md** | GEMINI_API_KEY: "Yes" (required) | API key can come from **Admin settings** OR env; at least one must be set |

### Missing Documentation

| Gap | Where to add |
|-----|---------------|
| **Q2/Q3 prompt templates** — Admin-editable, placeholders `{context}`, `{word_limit}` | api/README.md (Admin section), guides/admin-guide.md |
| **report_utils** — `first_line`, `truncate_to_words`, `get_stored_prompt_template`, `INCIDENT_QUERY_KEYS` | ARCHITECTURE.md (question_processors section) |
| **API key resolution** — Admin stored key vs env; `ensure_genai_configured(api_key)` | ARCHITECTURE.md (LLM/GenAI), SETUP.md |
| **Backend refactor (March 2025)** — shared utils, INCIDENT_QUERY_KEYS | Optional: add refactor summary or link to `backend/REFACTOR_AUDIT_2025.md` |

### Redundancy

| Item | Notes |
|------|-------|
| **DOCUMENTATION_UPDATE_PLAN.md** vs **DOCUMENTATION_UPDATE_PLAN_2025.md** | Original plan says "Phase 4 Completed"; new plan captures 2025 gaps. Consider archiving or merging. |
| **AUDIT_REPORT_RECENT_FEATURES.md** | Historical audit log; Phase 3 fixes applied. Keep for traceability; no update needed unless we want a "status: resolved" banner. |

---

## Phase 3: Documentation Update Plan (STOP for approval)

### Update (refresh existing files)

| File | Changes |
|------|---------|
| **ARCHITECTURE.md** | Fix Full Details Q2: "short follow-up question (~10 words)" not "2–3 sentence summary"; add q2PromptTemplate, q3PromptTemplate to Settings; update report_utils.py section with first_line, truncate_to_words, get_stored_prompt_template, INCIDENT_QUERY_KEYS |
| **api/README.md** | Fix Q2 description: short question, not summary; add q2PromptTemplate, q3PromptTemplate to Admin GET/PUT; fix apiKey: "Primary Gemini credential; stored in Admin or env"; fix Q3: LLM generates excerpt, fallback to settings on failure |
| **guides/admin-guide.md** | Fix API Key: used for Gemini (chat, Q2, Q3, embeddings); add sections for Q2 Prompt Template and Q3 Prompt Template |
| **guides/user-guide.md** | Fix Q2: "An AI-generated follow-up question appears (~10 words) based on your Q1 answer and incident context" |
| **testing/README.md** | Fix Form Flow and curl comments: Q2 = "short question" not "AI summary" |
| **SETUP.md** | Clarify: API key required from Admin settings OR GEMINI_API_KEY in .env |

### Create (new files)

| File | Purpose |
|------|---------|
| **None** | All gaps addressed via Updates |

### Delete / Merge

| Action | Target | Reason |
|--------|--------|--------|
| **Optional** | `docs/DOCUMENTATION_UPDATE_PLAN.md` | Superseded by this plan; could archive to `docs_archive/` or merge "Phase 4 Completed" note into README |

---

## Summary Table

| Action | Count |
|--------|-------|
| Update | 6 files |
| Create | 0 |
| Delete | 0 (optional: archive old plan) |

---

**Recommendation:** Proceed with all Updates. Continuity: variable names, paths, and endpoint descriptions will match the codebase exactly.

---

**Approval required before Phase 4 (execution).**

---

## Phase 4: Execution (Completed)

All 6 documentation updates have been applied:

- **ARCHITECTURE.md**: Q2/Q3 descriptions, Settings keys, report_utils helpers, API key note
- **api/README.md**: Admin GET/PUT schema, Q2 short question, Q3 LLM flow, apiKey usage
- **guides/admin-guide.md**: API Key usage, Q2/Q3 Prompt Template sections
- **guides/user-guide.md**: Q2 follow-up question description
- **testing/README.md**: Form flow and curl comments
- **SETUP.md**: API key from Admin or env
