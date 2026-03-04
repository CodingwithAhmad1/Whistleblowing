# Backend Refactor Roadmap — Latest Audit

**Date:** March 2025  
**Scope:** Backend only. No frontend changes.  
**Goal:** Optimize logic, remove redundancy, ensure file continuity.

---

## Phase 1: Efficiency Audit

### 1. Repeated Logic Identified

| Pattern | Files | Notes |
|---------|-------|-------|
| Admin settings response (pop apiKey + add default prompts) | `admin.py` | **Repeated 3×** — GET (22–26), PUT no-updates (46–50), PUT success (54–57) |
| `api_key = get_settings().get("apiKey") or None` + `ensure_genai_configured(api_key)` | `registry.py`, `embeddings/service.py` | Same 2-line init pattern |
| `if "key" in body: updates["key"] = body["key"]` | `admin.py` | Repeated 4× for policyExcerpt, apiKey, q2PromptTemplate, q3PromptTemplate |
| `if "key" in updates: current["key"] = ...` | `settings/store.py` | Repeated 4× in update_settings |

### 2. Optimization Wins

| Location | Issue | Impact |
|----------|-------|--------|
| `admin.py` | Response-building block duplicated 3× | Medium — extract `_admin_settings_response(data)` |
| `admin.py` | Body key extraction repeated 4× | Low — loop over `ADMIN_SETTINGS_KEYS` |
| `registry.py`, `embeddings/service.py` | Same 2-line GenAI init | Low — add `ensure_genai_from_settings()` |
| `settings/store.py` | Repetitive update blocks | Low — loop; policyExcerpt has special has_value logic |

### 3. File Continuity

| Item | Status |
|------|--------|
| Logger pattern | ✅ Consistent |
| Import style | ✅ Relative imports |
| Singleton getters | ✅ Consistent |
| admin.py docstring | ⚠️ Still mentions `apiKey` in PUT body; UI no longer sends it |

---

## Phase 2: Cleanup Roadmap (STOP for approval)

---

### Optimization 1: Extract `_admin_settings_response` in admin.py

| Field | Value |
|-------|-------|
| **Optimization** | Add helper `_admin_settings_response(data: dict) -> dict` that: pops `apiKey`, adds `defaultQ2PromptTemplate`, `defaultQ3PromptTemplate`, `defaultPolicyExcerpt`. Use in GET, both PUT branches. |
| **Files Affected** | `backend/app/routers/admin.py` |
| **Why** | Single place for response shaping; adding new default fields is one line. |
| **Continuity** | No renames. Internal helper. |

---

### Optimization 2: Add `ensure_genai_from_settings()` in genai_config

| Field | Value |
|-------|-------|
| **Optimization** | Add `ensure_genai_from_settings() -> None` that does `get_settings().get("apiKey") or None` + `ensure_genai_configured(api_key)`. Replace 2-line block in `registry.get_provider()` and `EmbeddingService._ensure_initialized()`. |
| **Files Affected** | `backend/app/llm/genai_config.py`, `backend/app/llm/registry.py`, `backend/app/embeddings/service.py` |
| **Why** | One-line call; single place if settings source changes. |
| **Continuity** | No external API changes. |

---

### Optimization 3: Admin PUT body key iteration (optional)

| Field | Value |
|-------|-------|
| **Optimization** | Define `ADMIN_SETTINGS_KEYS = ("policyExcerpt", "apiKey", "q2PromptTemplate", "q3PromptTemplate")`. Loop: `for k in ADMIN_SETTINGS_KEYS: if k in body: updates[k] = body[k]`. |
| **Files Affected** | `backend/app/routers/admin.py` |
| **Why** | Less repetition; adding a new key is one line in the tuple. |
| **Continuity** | No API changes. |
| **Note** | Optional; explicit blocks are readable. |

---

### Optimization 4: Settings store update loop (optional)

| Field | Value |
|-------|-------|
| **Optimization** | In `update_settings`, use a mapping for key → transform. policyExcerpt uses has_value; others use `str(val) if val is not None else ""`. Slightly more complex due to policyExcerpt special case. |
| **Files Affected** | `backend/app/settings/store.py` |
| **Why** | Less repetition. |
| **Continuity** | No API changes. |
| **Note** | Optional; policyExcerpt logic differs, so loop may not simplify much. |

---

### Optimization 5: Update admin.py PUT docstring

| Field | Value |
|-------|-------|
| **Optimization** | Change docstring from `Body: { "policyExcerpt"?, "apiKey"?, ... }` to `Body: { "policyExcerpt"?, "q2PromptTemplate"?, "q3PromptTemplate"? }` — remove apiKey from documented body (backend-only now). |
| **Files Affected** | `backend/app/routers/admin.py` |
| **Why** | Docstring matches actual usage. |
| **Continuity** | Doc only. |

---

## Summary Table

| # | Optimization | Effort | Impact |
|---|--------------|--------|--------|
| 1 | `_admin_settings_response` helper | Low | Medium |
| 2 | `ensure_genai_from_settings()` | Low | Low |
| 3 | Admin body key iteration (optional) | Low | Low |
| 4 | Settings update loop (optional) | Medium | Low |
| 5 | Admin PUT docstring | Trivial | Trivial |

---

## Recommendation

**Implement 1, 2, 5** for clear wins. **3** and **4** are optional polish.

---

**Approval required before Phase 3 (execution).**
