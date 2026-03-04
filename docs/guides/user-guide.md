# User Guide

## Introduction

ReportIQ helps you create structured whistleblowing reports through a multi-section form. Complete each section and export a PDF when ready.

## Getting Started

### Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- No special hardware required

### Opening the Application

1. Navigate to the ReportIQ URL.
2. Use the navigation bar: **Home** (report form) and **Admin** (settings, for administrators).
3. On Home, you see the report form with the header "Whistleblower Report".
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

- **Person(s) engaged in this behavior**: Add people with first name, last name, title. Use "Add another person" for more.
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
- **Full details** — a dynamic wizard:
  1. **Q1**: Describe what happened in your own words (violation, witnesses, evidence, timeline, etc.). Click **Next** when done.
  2. **Analyzing**: The system briefly analyzes your response to identify any important details that may be missing.
  3. **Follow-up questions** *(0–2, depending on your Q1 response)*: Targeted questions are shown one at a time based on gaps identified in your narrative (e.g. missing timeline, no specific example, unclear individuals involved). Answer each question and click **Next** or **Done**.
  4. **Review**: All your answers are shown together in an editable panel. You can edit any answer before submitting.

## Exporting Your Report

1. Complete the sections (required fields marked with *).
2. Click **Submit** at the bottom.
3. A PDF is generated and downloaded with your responses.

## Admin Page (Administrators)

If you have access to **Admin** (via the navigation bar), you can configure the **intake gap types** — the categories of missing information the system checks for after Q1 — as well as prompt templates and model usage. See [Admin Guide](admin-guide.md) for details.

## Tips

- Use specific dates, names, and locations in your Q1 response — this reduces the number of follow-up questions the system needs to ask.
- Mention any evidence you have (emails, documents, screenshots) in your Q1 response.
- The "Persons concealing" section lists example actions (e.g. "Ignored it", "Changed documents").
- You can edit any field before submitting.
- Report data is stored in your browser session; refreshing clears it.
- If the analysis step fails (network error or backend unavailable), you can click **Skip & Continue** to proceed without follow-up questions.
