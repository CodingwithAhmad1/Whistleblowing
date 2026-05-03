# Admin Guide

## Overview

The **Admin** page (`/admin`) is visible from the navigation bar in **Manager** mode. It currently contains:

1. **Gemini Activated** — one-click probe that the backend can reach Google Gemini using the configured API key and model chain.
2. **AI Pipeline Diagnostics** — run fixtures through intake (Layers 1–3), constructed-sentence generation, and RAG retrieval for regression checks.
3. **Gap Configuration** — create, edit, reorder, and persist **intake gap** definitions that drive the 0–2 template follow-ups in Full Details.

In development the page is typically `http://localhost:5173/admin` (Vite dev server, not the FastAPI port).

---

## Gap Configuration

The intake pipeline evaluates gaps **after** Layer 1 produces structured extraction JSON from labeled report sections (narrative, chronology, sequence, evidence, etc.). **Layer 2 is deterministic** — no LLM scores gaps.

### What is a gap?

A gap is a rule plus a **template string**. If the rule fires, the template becomes one of the follow-up questions shown to the reporter. The backend walks active gaps in **ascending priority number** (1 = highest) and stops after collecting **at most two** matching gaps for that run.

### Gap fields

| Field | Description |
|-------|-------------|
| **Label** | Shown on cards in the Admin UI |
| **Priority** | Sort order for evaluation (lower number = examined first) |
| **Active** | Inactive gaps are skipped |
| **Criteria type** | `boolean_false`, `empty_array`, or `length_threshold` (see [ARCHITECTURE.md](../ARCHITECTURE.md)) |
| **Target field** | Which Layer 1 JSON field the criterion inspects |
| **Min characters** | For `length_threshold`: gap fires when narrative length is **below** this value |
| **Template** | Question text shown when the gap fires (short, concrete prompts work best; max length enforced server-side) |

### Default gaps (five)

These ship in `backend/app/prompts/intake_gaps.py` and load from settings when no custom list is stored:

| Priority | ID | Criterion | Layer 1 field |
|----------|-----|-----------|----------------|
| 1 | `no_specific_example` | `boolean_false` | `specific_examples_present` |
| 2 | `no_witnesses_mentioned` | `boolean_false` | `witnesses_mentioned` |
| 3 | `no_prior_reporting` | `boolean_false` | `prior_reporting_mentioned` |
| 4 | `no_impact_described` | `boolean_false` | `impact_described` |
| 5 | `no_retaliation_context` | `boolean_false` | `retaliation_mentioned` |

**Conditional suppression** (examples): a long **sequence of events** answer may suppress the specific-example gap; answering that management is **aware** can suppress the prior-reporting gap. See `intake_processor.py` for the authoritative rules.

### Managing gaps

- **Edit:** Expand a card, modify fields, and confirm — a `PUT /api/admin/intake-gaps` runs immediately on save.
- **Reorder:** Drag cards to change priority; a silent save runs when you drop.
- **Delete:** Confirm deletion on the card; the reduced list saves immediately.
- **Reset / add gap:** Follow the in-UI controls; any successful write bumps `whistleblow_settingsModified` in `sessionStorage` so stale intake cache is invalidated client-side.

---

## Gemini Activated

Uses `POST /api/admin/gemini-test` (or equivalent route wired in `API_CONFIG`) to verify credentials. If this fails, intake and other LLM-backed steps will also fail until `GEMINI_API_KEY` (or admin-stored key) is fixed.

---

## AI Pipeline Diagnostics

Runs scripted **fixtures** end-to-end:

- Intake Layer 1 extraction  
- Layer 2 gap detection  
- Layer 3 template selection  
- Constructed sentence  
- RAG retrieval / reranking  

Use this after changing prompts, gap logic, or embedding/policy index data. History is optional and can be cleared from the UI.

---

## Legacy HTTP endpoints (not the primary Full Details UI)

`POST /api/questions/q2/generate` and `POST /api/questions/q3/generate` still exist for **LLM-only** question/excerpt experiments. The production Full Details wizard uses **gap templates** for follow-ups and **RAG** (`POST /api/rag/policy-quote` + constructed sentence) for the policy excerpt — not those endpoints.

Settings keys such as `q2PromptTemplate` / `q3PromptTemplate` may remain in `settings.json` for those legacy routes, but they are **not edited on the current Admin page**.

---

## Backend-only configuration

| Need | How |
|------|-----|
| Gemini API key | `GEMINI_API_KEY` in `backend/.env`, or merge into `backend/data/settings.json` under `apiKey` if you extend the admin API |
| Default model | `GEMINI_MODEL` in `backend/.env` (see [ARCHITECTURE.md](../ARCHITECTURE.md) for fallback chain) |
| Policy Chroma index | Populate `backend/data/chroma` via your ingestion workflow; RAG routers expect the whistleblowing collection |

---

## Security

Admin and intake-gap routes are **unauthenticated** in the prototype. Protect them (VPN, SSO, reverse proxy ACLs) before any production exposure.

---

## API reference

See [API Reference](../api/README.md) for `GET/PUT/POST/DELETE /api/admin/intake-gaps` and related payloads.
