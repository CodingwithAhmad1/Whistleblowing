# Documentation Update Plan

**Phase 2 Output** — Awaiting approval before Phase 4 execution.

---

## Phase 1: Location Discovery ✅

**Central documentation folder:** `/docs`

| File | Purpose |
|------|---------|
| `docs/README.md` | Index, quick links |
| `docs/ARCHITECTURE.md` | Tech stack, data flow, components |
| `docs/SETUP.md` | Development setup |
| `docs/api/README.md` | WebSocket and REST API reference |
| `docs/development/standards.md` | Coding standards |
| `docs/guides/user-guide.md` | End-user guide |
| `docs/performance/README.md` | Performance notes |
| `docs/testing/README.md` | Testing guide |

---

## Phase 2: Audit & Gap Analysis

### Outdated Information

| Doc | Issue | Current Code |
|-----|-------|--------------|
| **ARCHITECTURE.md** | "AI chat backend... not currently exposed in UI" | **False** — Full Details Q2/Q3 call `/api/questions/q2/generate` and `/api/questions/q3/generate` |
| **ARCHITECTURE.md** | Frontend layout omits Navbar, routing, HomePage, AdminPage | App has React Router (`/`, `/admin`), Navbar with Home/Admin |
| **ARCHITECTURE.md** | Backend file structure outdated | Missing: `routers/questions.py`, `routers/admin.py`, `llm/genai_config.py`, `settings/`, `question_processors/`, `embeddings/` |
| **ARCHITECTURE.md** | Storage says "Embeddings... not yet wired" | Partially true — policy_quoting returns `[]`; embeddings service/store exist |
| **ARCHITECTURE.md** | Config table missing vars | Missing: GEMINI_EMBEDDING_MODEL, HOST, PORT, CORS_ORIGINS |
| **development/standards.md** | File org shows `routers/reports.py`, `services/`, `utils/` | Actual: `chat.py`, `questions.py`, `admin.py`; no `services/` or `utils/` |
| **development/standards.md** | Uses `next/router` | Project uses `react-router-dom` |
| **development/standards.md** | Test examples reference `ReportService`, `LLMService` | These classes don't exist |

### Missing Documentation

| Gap | Where to add |
|-----|--------------|
| **Admin Settings** — GET/PUT `/api/admin/settings` (policy excerpt, API key) | api/README.md |
| **Question generation** — POST `/api/questions/q2/generate`, `/api/questions/q3/generate` | api/README.md |
| **Admin page** — What it does, who uses it | guides/user-guide.md, ARCHITECTURE.md |
| **Full Details wizard** — Q1 (user text), Q2 (AI summary), Q3 (policy excerpt + question) | guides/user-guide.md, ARCHITECTURE.md |
| **Backend shared modules** — `genai_config`, `report_utils.has_value`, `get_filled_report_fields` | ARCHITECTURE.md (backend section) |
| **Settings store** — JSON file, file locking, `data/settings.json` | ARCHITECTURE.md, SETUP.md |
| **filelock** dependency | SETUP.md or requirements note |
| **VITE_API_BASE_URL** for production frontend | SETUP.md |

### Redundancy

| Item | Notes |
|------|-------|
| SETUP.md vs testing/README.md | Both describe "start backend/frontend" — acceptable overlap; testing adds form flow |
| development/standards.md | Long example code for services that don't exist — simplify to match actual structure |

---

## Phase 3: Documentation Update Plan

### Update (refresh existing files)

| File | Changes |
|------|---------|
| **ARCHITECTURE.md** | Fix AI exposure claim; add Navbar, routing, HomePage, AdminPage; rewrite backend layout (routers, llm, settings, question_processors, embeddings); add Full Details data flow; update config table; add Mermaid for new flows |
| **api/README.md** | Add Admin Settings (GET/PUT), Question generation (POST q2/q3) with request/response schemas |
| **SETUP.md** | Add filelock to deps note; add VITE_API_BASE_URL for prod; add GEMINI_EMBEDDING_MODEL if documenting config |
| **guides/user-guide.md** | Add Admin section; rewrite Incident Details to describe Full Details 3-step wizard (Q1, Q2, Q3) |
| **development/standards.md** | Replace file-org example with actual structure; replace Next.js with React Router; align test examples with real modules (session_store, get_processor) |
| **testing/README.md** | Add Full Details wizard to form flow; add Admin/Question endpoint examples |
| **performance/README.md** | Add backend notes: genai single configure, heapq in embeddings, settings file locking |

### Create (new files)

| File | Purpose |
|------|---------|
| **docs/guides/admin-guide.md** | Admin page: configure policy excerpt for Q3, optional API key, retry on load failure |

### Delete / Merge

| Action | Target | Reason |
|--------|--------|--------|
| **None** | — | No redundant docs to delete; admin-guide is additive |

---

## Summary Table

| Action | Count |
|--------|-------|
| Update | 7 files |
| Create | 1 file |
| Delete | 0 |

---

**Recommendation:** Proceed with Updates 1–7 and Create admin-guide. Continuity: all variable names, paths, and endpoint URLs will match the codebase exactly.

---

## Phase 4: Execution (Completed)

All updates have been applied. Documentation is now synchronized with the codebase.
