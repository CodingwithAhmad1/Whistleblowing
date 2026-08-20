# Speak-Up Assistant — System Specification

A whistleblowing intake assistant with three AI components. Components A and B assist the reporter. Component C acts on the institution: it detects conduct the firm's policy fails to cover and proposes the clause that would cover it.

The loop: reports come in → retrieval finds what policy doesn't cover → unmatched conduct accumulates → the system proposes an amendment → revised policy changes what subsequent retrieval matches and what questions get asked.

---

## Component A — Question selection (built)

An LLM selects and sequences follow-up questions from a fixed, pre-authored set. It never generates new questions.

- **Input:** reporter's free-text account (partial or complete) + questions already answered.
- **Output:** ranked question IDs with relevance scores.
- **Constraint:** output is validated against the question registry; any ID not in the registry is dropped.

**Question registry.** Each question: `id`, `text`, `slot` (which schema field it fills), `preconditions` (slots that must already be filled), `sensitivity` (flag for questions that materially narrow identifiability).

**Sourcing.** Seed from compliance/legal authoring. Where historical investigator follow-up correspondence is available, mine it to ground the set in what investigators actually asked rather than what they believe they ask.

**Instrumentation (required, not optional).** Log per session: questions asked, order, count-to-sufficiency, reporter language proficiency band, and account length. This is what makes the equity claim measurable — the analysis asks whether the system needs more questions to reach the same sufficiency from some reporters than others.

---

## Component B — Dual-corpus retrieval (built, needs extension)

Two separately indexed corpora, queried independently, results compared.

| Corpus | Contents | Maintained by |
|---|---|---|
| `policy` | Firm conduct policy, code of conduct, handbook | Firm |
| `legal` | Statute, directives, regulator guidance, ILO instruments, by jurisdiction | Neutral/shared |

**Retrieval contract.**
- Excerpts surfaced verbatim with a pinned reference (`corpus`, `document_id`, `section`, `char_span`).
- No paraphrase presented as authoritative. Any model interpretation is returned in a separate field and rendered visually separate in the UI.
- Absence of a match is never rendered as "no violation occurred." Copy must attribute silence to the index, not the conduct.

**The extension — coverage classification.** For each account, compare the two result sets and classify:

| Class | Condition | Meaning |
|---|---|---|
| `covered` | policy match ≥ τ | Firm policy addresses this |
| `legal_only` | legal match ≥ τ, policy match < τ | **Policy gap** — law covers it, firm's rules don't |
| `policy_only` | policy match ≥ τ, legal match < τ | Firm exceeds statutory floor |
| `uncovered` | both < τ | Neither addresses it — potential novel conduct type |

`legal_only` and `uncovered` are the inputs to Component C.

**Thresholds.** Prefer conformal prediction over a tuned scalar cutoff — it returns a coverage-guaranteed candidate set rather than a point decision. Calibration requires a labelled set; build it from constructed vignettes with known ground truth, not from live reports.

---

## Component C — Policy amendment proposal (to build)

Detects accumulated coverage gaps and proposes remedial policy language. This is the novel component.

### C1. Gap accumulation

Unmatched accounts are clustered by conduct similarity (embedding over the extracted schema, not over raw prose). A cluster becomes a **candidate gap** when it passes three thresholds:

- `n_min` — minimum distinct reports in the cluster (evidence volume)
- `sim_min` — minimum intra-cluster similarity (they really are the same conduct)
- `window` — reports fall within a rolling time window (currency)

All three are tunable and reported as evaluation parameters. Evidence accumulation is the gating mechanism here, not model self-confidence.

### C2. Amendment generation — constrained

Generation is unavoidable at this step. Constrain it:

- **Anchor required.** Retrieve the nearest existing clause from `policy`, or the applicable provision from `legal`. Every proposal is an *adaptation of an anchor*, never a free draft.
- **Output is a diff.** Return the anchor verbatim, the proposed revision, and the changed spans. No standalone clause text.
- **Provenance chain.** Every proposal carries: cluster ID, contributing report IDs (pseudonymous), the anchor reference, and the `legal` provision motivating the change.
- **Reject if unanchored.** If no anchor retrieves above threshold, emit a coverage-gap notice with no proposed text. Silence is preferable to invention here.

### C3. Anti-gaming

A firm can narrow its policy to reduce visible gaps. Defence: the `legal` corpus is the floor and is not firm-controlled. The reported metric is the **gap between law and policy**, so narrowing policy widens the measured gap rather than closing it. Publish `legal_only` rate as a standing figure, not just amendment proposals.

### C4. Human gate

Component C proposes; it never amends. Output routes to a compliance reviewer with accept / modify / reject, and the decision is logged. Rejection reasons feed threshold tuning.

---

## Data model

**Account schema** (the extraction target — what the assessor sees, not the prose):

```
account_id, jurisdiction, reporter_status,
conduct_description, first_occurrence, frequency, ongoing,
witnesses_present, evidence_available,
firsthand_vs_reported (per assertion),
subject_role_band, reporter_role_band
```

Prose is retained only for span-linking and provenance; the assessment surface is the schema.

**Retrieval result:** `corpus, document_id, section, char_span, verbatim_text, score, interpretation (separate field)`

**Gap cluster:** `cluster_id, member_account_ids, centroid, intra_sim, first_seen, last_seen, status`

**Amendment proposal:** `proposal_id, cluster_id, anchor_ref, anchor_text, proposed_text, diff_spans, legal_ref, reviewer_decision`

---

## Cross-cutting requirements

**Provenance.** Every surfaced string is either verbatim-with-reference or explicitly marked as model interpretation. Enforce at the serialisation layer, not in prompts.

**Evidentiary posture.** Assume logs are subpoenable. No server-side draft history. Local-first drafting where feasible. Content telemetry is prohibited; analytics are structural only (question IDs, counts, coverage classes — never account text).

**Identifiability indicator.** Estimate how many people in the org the account could describe, given `subject_role_band` and team structure. Surface to the reporter, not the firm. Trigger on `sensitivity`-flagged questions.

**Equity gate.** Report variance in extracted-schema completeness across reporter literacy and language bands. Widening variance versus the unassisted baseline is a release blocker, not a footnote.

---

## Build order

1. Extend Component B with dual-corpus coverage classification (C1's input depends on it).
2. Gap clustering over the extracted schema.
3. Anchored amendment generation with diff output and reviewer gate.
4. Instrumentation and equity reporting across all three components.

## Evaluation

| Metric | Tests |
|---|---|
| Schema completeness variance across literacy bands | Whether the gap narrows or widens (headline) |
| Questions-to-sufficiency by band | Whether A extracts equally |
| Citation precision, human-audited | Whether B is right, not just confident |
| `legal_only` rate | Standing measure of policy-to-law gap |
| Amendment acceptance rate by reviewers | Whether C proposes usefully |
| Unanchored-rejection rate | Whether the generation constraint binds |

Calibrate on constructed vignettes with known ground truth. Live reporter data requires ethical review beyond this phase.
