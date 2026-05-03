# User Guide

## Introduction

ReportIQ helps you create structured whistleblowing reports through a multi-section form. Complete each section, run the Full Details assistant when prompted, then submit; you can export a PDF when ready.

## Getting Started

### Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Backend reachable if you want live AI intake, case summaries, policy retrieval, and a shared Feed

### Opening the Application

1. Navigate to the ReportIQ URL.
2. **Mode selector** (header): choose **Reporter**, **Investigator**, or **Manager**.
   - **Reporter:** **Home** only — focus on filing.
   - **Investigator:** **Home** + **Feed** (submitted cases).
   - **Manager:** **Home**, **Feed**, **Admin** (gap configuration and diagnostics), and **Document** (long-form product overview).
3. On Home, complete the report form (header: “Whistleblower Report”).
4. Scroll through the four sections and fill in the fields.

## Form Sections

### 1. Organization & Context

- **Organization / Tier**: Your organization or division.
- **Country**: Searchable country selection.
- **Location where incident occurred**: Searchable location.

### 2. Reporter Preferences

- **Are you an employee of the organization?** Yes / No
- **Do you wish to remain ANONYMOUS?** Yes / No

If you select **No** for anonymous:

- **Your Name**: First and last name
- **Your Phone Number**: Country code + number
- **Your Email Address**
- **Best time for communication with you**

### 3. Identifying Persons and Management

- **Person(s) engaged in this behavior**: Add people with first name, last name, title. Use “Add another person” for more.
- **Is a supervisor or management involved?** Yes / No / Do Not Know / Do Not Wish To Disclose
- **If yes, who?** (textarea)
- **Is management aware of this problem?** Yes / No / Do Not Know / Do Not Wish To Disclose

### 4. Incident Details

- **General nature of matter** (brief description)
- **Where did this incident occur?**
- **When did it occur?**
- **How long has it been going on?**
- **How did you become aware?**
- **If other, how?** (conditional)
- **Persons concealing** (with examples)
- **Full details** — a dynamic wizard with these stages:

| Stage | What you see |
|-------|----------------|
| **Q1 — Narrative** | Free-text description of what happened. |
| **Analyzing** | “Analyzing your report…” while the client POSTs to `/api/questions/intake/analyze` with your narrative plus form fields. |
| **Gap follow-ups (0–2)** | Template questions, shown **one at a time**, based on priority-ordered gap rules. Answer each, or you may see none if no gaps fired. |
| **Case summary** | Loading while the app requests a short **constructed sentence** summarising the matter for policy search. |
| **Finding relevant policy…** | Retrieves a policy excerpt (RAG) when the backend and index are available. |
| **Policy question** | Reviews the excerpt (if any) and asks **“How well does this policy excerpt describe your experience?”** — respond in your own words. |
| **Review** | Editable recap of Full Details answers before you continue with the rest of the form. |

If intake or downstream AI/RAG calls fail, use **Back**, **Skip & Continue**, or other recovery controls shown in the UI so you can still progress — the exact behavior depends on the error surfaced.

## After you leave Full Details

Finish any remaining incident fields, scroll to the bottom of the form, and **Submit**. Submissions sync to the **Feed** (`/feed`) for investigators when the API is running; otherwise they may store locally until the backend is available.

## Analysis Page (`/analysis`)

Developers and trainers can open **Analysis** for a read-only view of the **last intake response** cached in the browser’s session storage. Investigators should rely on **Feed** rows for real submissions.

## Exporting Your Report

1. Complete required fields (marked with \*).
2. Click **Submit** when the full form is ready.
3. When offered, download the generated PDF with your responses.

## Admin (Managers only)

Managers configure gap templates and run diagnostics on `/admin`. See [Admin Guide](admin-guide.md).

## Tips

- Richer Q1 answers and incident context reduce follow-up questions — mention dates, names, witnesses, and evidence where you safely can.
- Sequence-of-events and evidence-description fields count toward intake even before follow-ups.
- Report data in the editor is primarily in-memory until submit; refreshing the page can clear unsaved work.
- Keep **localhost** vs **127.0.0.1** consistent if you test browser storage edge cases — they are different origins.
