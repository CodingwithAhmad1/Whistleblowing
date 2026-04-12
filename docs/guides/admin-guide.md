# Admin Guide

## Overview

The **Admin** page (`/admin`) has three sections:

1. **Gap Configuration** — manage the intake gap types that drive the Full Details follow-up question wizard.
2. **Prompt Templates** — override the AI prompts used to generate Q2 follow-up questions and Q3 policy excerpts.
3. **Model Usage** — monitor per-model daily free-tier quota and all-time cumulative totals.

Access it from the navigation bar. The page is at `http://localhost:5173/admin` in development (use the Vite dev server URL, not the backend port).

---

## Gap Configuration

The **Gap Configuration** section lets you manage the gap types evaluated by the 3-layer intake pipeline after a user submits their Q1 narrative. Each active gap has criteria that are checked deterministically against the structured extraction of Q1 — no LLM is involved in gap evaluation itself.

### What Is a Gap?

A gap is a category of missing or unclear information in the reporter's narrative. When a gap's criteria are met, its question template is used to generate a follow-up question shown to the reporter. The system returns at most 2 follow-up questions per submission (the highest-priority gaps found).

### Gap Fields

| Field | Description |
|-------|-------------|
| **Label** | Human-readable name shown in the Admin UI |
| **Priority** | Evaluation order (1 = highest priority). The backend evaluates gaps in priority order and stops after finding 1. |
| **Active** | Toggle to include/exclude this gap from analysis without deleting it |
| **Criteria type** | How the gap is detected (see below) |
| **Criteria field** | The Layer 1 extraction field to evaluate |
| **Threshold** | For `length_threshold` type: minimum character count (gap fires if below this) |
| **Template** | The question text shown to the reporter when this gap is identified |

### Criteria Types

| Type badge | Fires when... |
|------------|---------------|
| **Bool flag** (`boolean_false`) | The Layer 1 boolean field is `false` |
| **Array empty** (`empty_array`) | The Layer 1 list field is empty |
| **Min length** (`length_threshold`) | `length_character_count` in Layer 1 is below the threshold |

### Default Gaps

Seven gaps ship by default (in priority order):

1. **Timeline Unclear** — fires when `timeline_clear` is false
2. **No Specific Example** — fires when `specific_examples_present` is false
3. **No Evidence** — fires when `evidence_described` is false
4. **Missing Date** — fires when `dates_mentioned` is empty
5. **Missing Individuals** — fires when `people_mentioned` is empty
6. **Missing Location** — fires when `locations_mentioned` is empty
7. **Narrative Too Short** — fires when character count is below 300

### Managing Gaps

**Edit a gap:**
1. Click **Edit** on any gap card.
2. Modify any fields in the inline form.
3. Click **Save gap changes** to persist all staged edits.

**Reorder gaps:**
Use the ▲/▼ arrows on each card to swap priority order. Reordering is staged — click **Save gap changes** to persist.

**Add a gap:**
1. Click **Add Gap** at the bottom of the list.
2. Fill in label, criteria, and template fields.
3. Click **Save gap changes**.

**Delete a gap:**
Click **Delete** on a gap card, then confirm. Deletion is staged — click **Save gap changes** to persist.

**Toggle active/inactive:**
Use the checkbox on each gap card to enable or disable it without deleting it. Inactive gaps are skipped during analysis.

> **Note:** Changes are staged locally until you click **Save gap changes**. Navigating away without saving discards your edits. After saving, the analysis cache in the browser is automatically invalidated so the next report analysis uses the updated gap configuration.

---

## Prompt Templates

### Q2 — Follow-up Question (optional)

The LLM prompt used to generate the short follow-up question (~10 words) in **Full Details Q2**. Leave empty to use the built-in default.

- **Placeholders**: `{context}` = labeled incident fields extracted from the report, `{word_limit}` = 10
- **Example**: `"Generate exactly one short question, exactly {word_limit} words, related to: {context}"`
- **Default**: Shown as helper text beneath the field when left empty.
- **Effect**: The generated question appears above the Q2 textarea as a styled heading and is persisted to `full_details_q2_question` in the report for inclusion in the PDF.
- **Invalid placeholders**: Any `{placeholder}` other than `{context}` and `{word_limit}` will cause the Q2 endpoint to return `422 Unprocessable Entity`. The Full Details wizard will show an error until the template is corrected or cleared.

### Q3 — Policy Excerpt (optional)

The LLM prompt used to generate the policy excerpt in **Full Details Q3**. Leave empty to use the built-in default.

- **Placeholders**: `{context}` = incident query string, `{word_limit}` = 20
- **Example**: `"Generate a policy quote about whistleblowing, maximum {word_limit} words. Context: {context}"`
- **Default**: Shown as helper text beneath the field when left empty.
- **Effect**: The generated excerpt appears as a block-quote above the Q3 textarea and is persisted to `full_details_q3_excerpt` for inclusion in the PDF.
- **Invalid placeholders**: Any `{placeholder}` other than `{context}` and `{word_limit}` will cause the Q3 endpoint to return `422 Unprocessable Entity`. Clear or fix the template to restore normal Q3 generation.

---

## Model Usage

The **Model Usage** section shows today's request and token consumption for each Gemini model against the free-tier daily limits, plus all-time cumulative totals across the last 7 days.

| Column | Description |
|--------|-------------|
| Model name | Gemini model identifier |
| **Active** badge | The model currently selected by the fallback chain |
| **Exhausted** badge | Model returned a 429 today; no longer used until UTC midnight |
| Requests bar | Requests used / 1,500 daily limit |
| Tokens bar | Estimated tokens used / 1,000,000 daily limit |

**Color coding:**
- Green — < 70% used
- Amber — 70–90% used
- Red — ≥ 90% used (or Exhausted)

**Cumulative row:** Displays all-time totals summed across all stored days (up to 7 days of retention). Useful for monitoring overall API consumption trends.

The section refreshes automatically every 30 seconds.

**Fallback chain:** When the active model returns HTTP 429, the backend automatically switches to the next available model in order: `gemini-2.0-flash` → `gemini-2.5-flash-lite` → `gemini-2.5-flash`. The starting model is set via `GEMINI_MODEL` in `backend/.env`. Skipped models are remembered until UTC midnight for that server process (in-memory).

---

## Usage

### Loading Settings

1. Open **Admin** from the navigation bar.
2. The page fetches current settings from `GET /api/admin/settings`.
3. If loading fails (backend unreachable), an error is shown and **Save** is disabled. Click **Retry load** to try again.

### Saving

1. Edit **Q2 — Follow-up Question** and/or **Q3 — Policy Excerpt** fields.
2. Click **Save changes**.
3. A confirmation message appears on success. Changes take effect immediately for all new Q2/Q3 requests.

### Load Failure

If initial load fails, **Save** remains disabled to prevent overwriting server state with empty values. Click **Retry load** to refetch.

---

## Backend-Only Configuration

Some settings are not exposed in the Admin UI and must be configured in `backend/.env`:

| Setting | How to set |
|---------|------------|
| Gemini API key | `GEMINI_API_KEY=...` in `backend/.env`, or `PUT /api/admin/settings` with `{ "apiKey": "..." }` via direct API call |
| Preferred model | `GEMINI_MODEL=gemini-2.0-flash` in `backend/.env` |
| Policy excerpt fallback | `PUT /api/admin/settings` with `{ "policyExcerpt": "..." }` via direct API call |

---

## Security Note

The Admin endpoints (`GET` and `PUT /api/admin/settings`, intake gap CRUD under `/api/admin/intake-gaps`, etc.) do **not** require authentication in the current implementation. Restrict access to the Admin page (e.g., via network policy, reverse proxy, or future auth middleware) before deploying to production.

---

## API Reference

See [API Reference](../api/README.md#admin-settings) for full request/response details.
