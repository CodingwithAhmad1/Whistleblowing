import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

interface GapRow {
  color: string
  priority: number
  gap: string
  check: string
}

/** Matches default gaps in backend/app/prompts/intake_gaps.py — deployments may override via Admin. */
const GAP_ROWS: GapRow[] = [
  {
    color: '#f97316',
    priority: 1,
    gap: 'No Specific Example',
    check: 'Layer 1 flag `specific_examples_present` is false — no concrete example the model can treat as specific.',
  },
  {
    color: '#22c55e',
    priority: 2,
    gap: 'No Witnesses Mentioned',
    check: '`witnesses_mentioned` is false — no corroborating people or records surfaced in the merged text.',
  },
  {
    color: '#06b6d4',
    priority: 3,
    gap: 'No Prior Reporting Mentioned',
    check: '`prior_reporting_mentioned` is false — no prior escalation called out.',
  },
  {
    color: '#ef4444',
    priority: 4,
    gap: 'No Impact Described',
    check: '`impact_described` is false — harm or consequence not articulated.',
  },
  {
    color: '#6366f1',
    priority: 5,
    gap: 'No Retaliation Context',
    check: '`retaliation_mentioned` is false — no retaliation or fear of reprisal described.',
  },
]

export function DocQ2(): JSX.Element {
  return (
    <section id="q2" className={styles.section}>
      <h3 className={styles.h3}>Gap-driven follow-ups (formerly framed as &ldquo;Q2&rdquo;)</h3>
      <p className={styles.p}>
        After Q1 (and enough context to run intake), the client calls the intake analyzer. Three stages run on
        the server before the reporter sees follow-up screens.
      </p>

      <p className={styles.p}>
        <strong>Step one — extraction (Layer 1, LLM).</strong> Labeled sections from the narrative and form —
        including chronology, sequence, evidence description, and structured answers — are consolidated into
        structured JSON: booleans, lists (people, dates, locations), a short summary, and related fields used
        as a checklist for gaps.
      </p>

      <p className={styles.p}>
        <strong>Step two — gap detection (Layer 2, deterministic).</strong> Active gaps from settings are
        sorted by priority. Each is tested against the merged checklist. At most <strong>two</strong> matching
        gaps are kept for this run. Conditional suppression avoids redundant prompts — for example a long
        sequence-of-events answer can suppress the &ldquo;no specific example&rdquo; gap, and marking
        management awareness as yes can suppress the prior-reporting gap when policy is configured that way.
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Default gap label</th>
            <th>What is being checked</th>
          </tr>
        </thead>
        <tbody>
          {GAP_ROWS.map(row => (
            <tr key={row.priority}>
              <td>
                <span className={styles.priorityDot} style={{ background: row.color }} />
                {row.priority}
              </td>
              <td>{row.gap}</td>
              <td>{row.check}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.p}>
        <strong>Step three — templates (Layer 3, no LLM).</strong> Each selected gap id maps to its stored
        template string (capped in length). The reporter sees those questions one after another — never more than
        two per analysis run. If no gap fires, this block is skipped entirely.
      </p>

      <DocCallout variant="teal">
        <p>
          <strong>Why cap at two questions?</strong> Each extra prompt adds burden during an already stressful
          disclosure. A small, priority-ordered set of templates keeps the experience bounded while still
          capturing the highest-value missing details before submit.
        </p>
      </DocCallout>

      <p className={styles.p}>
        Gaps that were evaluated but not shown to the reporter still appear in the investigator briefing, in
        priority order, so reviewers know what may still need follow-up if the matter proceeds.
      </p>
    </section>
  )
}
