# Product Roadmap: Whistleblowing Platform — AI & RAG Comprehensiveness

## Document Purpose

This document serves two purposes:

1. **Product roadmap** — a feature-level view of what needs to be built to make the whistleblowing form's AI-powered section comprehensive and production-ready.
2. **Engineering prompt** — a strategic brief for the software engineer, with clear goals and architectural guidance while leaving implementation flexibility.

---

## 1. Current State Summary

### What Exists

- **Policy document**: 3MRulesBook.pdf (62 pages), ingested into 63 chunks stored in ChromaDB.
- **Ingestion pipeline** (`backend/ingest_policy.py`): Extracts text via pdfplumber, chunks into 100–350 word segments, embeds with `gemini-embedding-001`, stores in ChromaDB with cosine similarity.
- **RAG query service** (`backend/app/rag/service.py`): Embeds a user query via Gemini, retrieves the single closest chunk from ChromaDB (cosine threshold ≥ 0.3), returns the quote text + page number.
- **API endpoint** (`POST /api/rag/policy-quote`): Receives form data (Q1, Q2, general nature, location), concatenates fields into a raw query string, passes to RAG service.

### What's Lacking

| Gap | Impact |
|-----|--------|
| Only 1 result returned (`n_results=1`) | No fallback if top match is weak |
| No section/chapter metadata | Quote context limited to "Page X" — no structural reference |
| No LLM parsing or refinement | Raw concatenated text is a poor query; no verification of relevance |
| No constructed sentence | Form answers are naively joined, not semantically shaped |
| No re-ranking | Embedding similarity is the only signal |
| Static ingestion | PDF changes require manual re-run |
| Basic chunking | No awareness of document structure (headers, sections, tables) |

---

## 2. The Three Final Form Questions (Context)

The whistleblowing form ends with three questions where AI is embedded. These are not changing — they are fixed. The work is about making the AI behind them comprehensive and reliable.

| # | Question | AI Role |
|---|----------|---------|
| Q1 | Asks the whistleblower to input specific details of the incident | **No AI.** Pure user input. This is the primary context source. |
| Q2 | An AI-generated follow-up question to spur the user into adding more details | **Gemini LLM generates** a contextual follow-up question based on all prior form answers. |
| Q3 | Displays the most relevant policy quote and asks the user how relevant it is | **RAG retrieval** returns the best policy quote. User rates its relevance (feedback loop). |

### Important: The AI pipeline is two-stage

**Stage 1 — LLM Context Parsing**: Before any retrieval happens, a Gemini LLM call must parse and synthesize all available form context (not just the last section — all earlier answers too) into a clean, semantically meaningful query. This is the "constructed sentence."

**Stage 2 — RAG Retrieval**: The constructed sentence is then used to query ChromaDB for the most relevant policy quote.

The engineer must treat these as two distinct, sequential steps — not a single concatenation-and-embed operation.

---

## 3. Feature Roadmap

### 3.1 Constructed Sentence (NEW — Must Build)

**Goal**: Transform raw form answers into a single, well-formed narrative sentence that captures the essence of the report for optimal retrieval.

**Guidance for the engineer**:

- Use Gemini (the same model family already in the stack) to generate the constructed sentence.
- The input to the LLM should include **all** form answers collected up to that point — not just Q1. Earlier questions (general nature of the issue, where it occurred, department, etc.) carry important context.
- The prompt to Gemini should instruct it to produce a concise, factual summary sentence — not a question, not a paragraph. Something like: *"An employee in [department] reports [nature of issue] involving [specific details], which occurred at [location]."*
- The constructed sentence is the single artifact that gets embedded and sent to ChromaDB. It replaces the current naive concatenation.
- Store the constructed sentence alongside the report for audit/debugging purposes.

**Acceptance criteria**:
- Given identical form inputs, the constructed sentence should be deterministic or near-deterministic (use low temperature).
- The sentence should read as a coherent, human-understandable summary of the report.
- It should never include hallucinated details not present in the form answers.

---

### 3.2 RAG Pipeline Improvements

#### 3.2.1 Increase Retrieved Results

- Change `n_results` from 1 to 3–5 candidates.
- Return the top result to the user but keep the others available for re-ranking or fallback.

#### 3.2.2 Add Section/Chapter Metadata to Chunks

- Re-process the PDF ingestion to extract section headers, chapter titles, and structural context.
- Store this metadata alongside each chunk in ChromaDB.
- When returning a quote, include the section title (e.g., *"Section 4: Conflicts of Interest — Page 12"*) instead of just "Page X."

#### 3.2.3 Add LLM-Based Relevance Verification

- After ChromaDB returns the top candidates, pass them through a Gemini LLM call that evaluates: *"Given this report summary: [constructed sentence], is the following policy quote relevant? Rate 1–5 and explain briefly."*
- Use this as a re-ranking signal. If no candidate scores above a threshold, return a "no relevant policy found" response rather than a weak match.
- This is the cross-encoder/re-ranking step that's currently missing.

#### 3.2.4 Improve Chunking Strategy

- The engineer should explore structure-aware chunking: respect section boundaries, keep headers attached to their content, handle tables and lists as atomic units where possible.
- This is a lower-priority improvement but should be considered during ingestion rework.

---

### 3.3 Q2: AI-Generated Follow-Up Question

**Goal**: After the user answers Q1, Gemini generates a smart follow-up question that encourages the whistleblower to provide additional useful detail.

**Guidance for the engineer**:

- The follow-up question should be generated based on all prior form context, not just Q1.
- The prompt to Gemini should be designed to identify gaps in the report — what's missing that would help an investigator? What's vague that could be more specific?
- The question should be open-ended, non-leading, and professional in tone.
- The question must never suggest or imply a conclusion about guilt, innocence, or severity.
- Use Gemini for this call, consistent with the rest of the stack.

---

### 3.4 Q3: Policy Quote Display & Relevance Feedback

**Goal**: Display the best policy quote to the user and collect their assessment of its relevance.

**Guidance for the engineer**:

- The quote displayed should be the top-ranked result after the full pipeline runs (constructed sentence → embedding → ChromaDB retrieval → LLM re-ranking).
- Include the section title and page number for context.
- The relevance feedback from the user (Q3 response) should be stored and can be used in the future to fine-tune retrieval quality.
- If the pipeline determines no quote meets the relevance threshold, display a clean message rather than forcing a weak match.

---

## 4. Backend Test Feature

### 4.1 Purpose

A sequential, automated backend test that simulates the three-question AI flow end-to-end. This test should:

1. Verify that the constructed sentence is generated correctly from sample form data.
2. Verify that the AI-generated follow-up question (Q2) is coherent and contextually appropriate.
3. Verify that the RAG pipeline returns a relevant policy quote (Q3) and that the relevance score meets the threshold.

The test must be runnable in two ways:
- **Programmatically** — via a test script or API endpoint that can be called in CI/CD or from the terminal.
- **From the admin panel** — a button in the React/Next.js admin UI that triggers the test and displays results in real time.

---

### 4.2 Engineering Prompt: Backend Test Implementation

> **To the software engineer:**
>
> Build a sequential backend test that validates the AI pipeline for the last three form questions. The test should be clean, modular, and exposable both as an API endpoint and through the admin panel. Here is what the test must do and the goals it must achieve. Implementation details are yours to decide.
>
> ---
>
> **Test Sequence**
>
> The test runs three steps in order. Each step depends on the output of the previous one. If a step fails, the sequence stops and reports exactly where and why.
>
> **Step 1 — Constructed Sentence Generation**
>
> - Input: A predefined set of sample form data (mock a complete form submission with realistic answers across all form fields — general nature, location, department, Q1 specific details, etc.).
> - Action: Call the constructed sentence generation endpoint/service with this data.
> - Assertions:
>   - The response is a non-empty string.
>   - The sentence is a coherent, grammatically correct summary.
>   - The sentence does not contain hallucinated information absent from the input.
>   - The sentence length is within a reasonable range (e.g., 20–150 words).
> - Output: The constructed sentence (passed to Step 2).
>
> **Step 2 — AI Follow-Up Question (Q2)**
>
> - Input: The same sample form data, plus the constructed sentence from Step 1.
> - Action: Call the Q2 generation endpoint/service.
> - Assertions:
>   - The response is a non-empty string that ends with a question mark.
>   - The question is contextually related to the form data (basic semantic check — the engineer can decide how to validate this, e.g., keyword overlap, or an LLM-as-judge call).
>   - The question is not leading or suggestive of a conclusion.
> - Output: The follow-up question (logged, not passed further).
>
> **Step 3 — Policy Quote Retrieval (Q3)**
>
> - Input: The constructed sentence from Step 1.
> - Action: Call the RAG pipeline endpoint with the constructed sentence.
> - Assertions:
>   - A policy quote is returned (or a clean "no relevant policy" response if below threshold).
>   - If a quote is returned, it includes: quote text, page number, and section title.
>   - The cosine similarity score meets the minimum threshold.
>   - If LLM re-ranking is implemented, the relevance score from the LLM is above the acceptable threshold.
> - Output: The quote, metadata, and scores.
>
> ---
>
> **Test Data**
>
> - Include at least 3 sample form submissions as test fixtures, covering:
>   - A clear-cut case (e.g., a bribery report that should match a specific anti-corruption section).
>   - An ambiguous case (e.g., a vague complaint that tests the system's ability to handle low-confidence matches).
>   - An edge case (e.g., a report about something not covered by the policy document, which should return "no relevant policy").
> - These fixtures should be stored in a dedicated test data file, not hardcoded in the test logic.
>
> ---
>
> **API Endpoint for the Test**
>
> - Create a dedicated endpoint (e.g., `POST /api/admin/test/ai-pipeline`) that runs the full test sequence.
> - The endpoint should be **admin-only** (protected by authentication/authorization).
> - The response should be structured JSON containing:
>   - Overall pass/fail status.
>   - Per-step results: status, inputs used, outputs generated, assertions passed/failed, timestamps, and latency for each step.
>   - Any error messages or stack traces if a step fails.
>
> ---
>
> **Admin Panel Integration**
>
> - Add a section to the existing React/Next.js admin panel (e.g., under a "Diagnostics" or "AI Health" tab).
> - Include a "Run AI Pipeline Test" button that calls the test endpoint.
> - Display results in real time or upon completion:
>   - A visual step-by-step indicator (Step 1 ✓, Step 2 ✓, Step 3 ✗).
>   - Expandable detail for each step showing inputs, outputs, and assertion results.
>   - Clear indication of what failed and why if a step doesn't pass.
> - Include a "Test History" view that stores and displays past test runs (timestamp, pass/fail, summary) so patterns can be tracked over time.
> - The test should be runnable on-demand — no scheduling required, but the engineer can add scheduling as an optional enhancement.
>
> ---
>
> **Technical Constraints**
>
> - Use Gemini for all LLM calls (embedding and generation), consistent with the existing stack.
> - The test must not write to the production report database — use isolated test data.
> - The test should complete within a reasonable time (target: under 30 seconds for the full sequence).
> - Log all test runs with timestamps and results for audit purposes.
>
> ---
>
> **Definition of Done**
>
> - The test can be triggered from both the terminal (e.g., `npm test` or `pytest`) and the admin panel.
> - All three steps run sequentially and report granular results.
> - At least 3 test fixtures cover clear, ambiguous, and edge-case scenarios.
> - The admin panel displays test results clearly with pass/fail indicators and expandable detail.
> - Test history is persisted and viewable in the admin panel.

---

## 5. Completeness Checklist

Use this checklist to verify the feature is comprehensive before considering it done.

| Area | Item | Status |
|------|------|--------|
| **Constructed Sentence** | LLM prompt designed and tested | ☐ |
| | All form fields (not just Q1) are included as input | ☐ |
| | Sentence is stored with the report for audit | ☐ |
| | Low-temperature setting for near-deterministic output | ☐ |
| **RAG Improvements** | `n_results` increased to 3–5 | ☐ |
| | Section/chapter metadata added to chunk store | ☐ |
| | LLM re-ranking step implemented | ☐ |
| | "No relevant policy" fallback for low-confidence results | ☐ |
| | Chunking improved to respect document structure | ☐ |
| **Q2 — Follow-Up Question** | Generated by Gemini from full form context | ☐ |
| | Non-leading, open-ended, professional tone | ☐ |
| | Tested with diverse form inputs | ☐ |
| **Q3 — Policy Quote Display** | Shows quote text + section title + page number | ☐ |
| | Relevance feedback captured and stored | ☐ |
| | Graceful handling when no relevant quote found | ☐ |
| **Backend Test** | 3-step sequential test implemented | ☐ |
| | At least 3 test fixtures (clear, ambiguous, edge case) | ☐ |
| | Admin API endpoint created and protected | ☐ |
| | Admin panel UI with run button and results display | ☐ |
| | Test history persisted and viewable | ☐ |
| | Test runnable from terminal as well | ☐ |
| **Infrastructure** | All LLM calls use Gemini | ☐ |
| | Test does not write to production data | ☐ |
| | Constructed sentence and test results are logged for audit | ☐ |

---

## 6. Priority Order

1. **Constructed Sentence** — this unlocks everything else. Without a well-formed query, retrieval will remain poor regardless of other improvements.
2. **RAG improvements** (increase results, add metadata, add re-ranking) — directly improves quote quality.
3. **Q2 follow-up generation** — depends on the same LLM infrastructure as the constructed sentence.
4. **Backend test + admin panel integration** — validates everything above works correctly and stays working.

---

## 7. Open Questions for the Engineer

- What is the desired behavior when the user skips optional form fields? Should the constructed sentence handle missing data gracefully, or should those fields be required?
- Should test history be stored in the main database or a separate diagnostics store?
- Is there a preference for the Gemini model variant to use for generation (e.g., Gemini Pro vs. Gemini Flash) given the cost/latency tradeoff?
- Should the admin panel test be environment-restricted (e.g., staging only) or available in production?
