import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

interface GapRow {
  color: string
  priority: number
  gap: string
  check: string
}

// Illustrative default set — live deployments may differ; admins configure the exact list in the Admin panel.
const GAP_ROWS: GapRow[] = [
  { color: '#f97316', priority: 1, gap: 'No specific example', check: 'Has the reporter given at least one concrete incident the AI can mark as a specific example?' },
  { color: '#22c55e', priority: 2, gap: 'No witnesses mentioned', check: 'Does the text name anyone who could corroborate (not only the people involved in the act)?' },
  { color: '#06b6d4', priority: 3, gap: 'No prior reporting mentioned', check: 'Does the text say whether this was raised to anyone before, and the outcome?' },
  { color: '#ef4444', priority: 4, gap: 'No impact described', check: 'Is harm or consequence (people, safety, financial, etc.) described explicitly?' },
  { color: '#6366f1', priority: 5, gap: 'No retaliation context', check: 'Is retaliation, fear of reprisal, or a chilling effect mentioned explicitly?' },
]

export function DocQ2(): JSX.Element {
  return (
    <section id="q2" className={styles.section}>
      <h3 className={styles.h3}>Q2 — The AI-generated follow-up</h3>
      <p className={styles.p}>
        Once the reporter submits Q1, the system analyses the narrative automatically. This analysis has three
        steps, running in the background while the reporter moves to the next screen.
      </p>

      <p className={styles.p}>
        <strong>Step one — extraction.</strong> The AI reads the Q1 narrative together with the earlier form
        fields. It produces an internal structured summary: which specific people are mentioned, whether a
        clear timeline can be reconstructed, whether concrete examples are described, whether any evidence is
        referenced, and so on. Think of this as the AI building a checklist of what the report does and does
        not contain.
      </p>

      <p className={styles.p}>
        <strong>Step two — gap detection.</strong> A set of rules — configured by the platform admin —
        checks that checklist. A small default set of gap types (five) is provided out of the box; the list and
        priority order are configurable. The system identifies the most important missing piece of
        information under those rules. It does not interrogate the reporter with long questionnaires.
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Priority</th>
            <th>Gap</th>
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
        The system is context-aware. Answers in structured fields can suppress a gap (for example, a long
        &ldquo;sequence of events&rdquo; answer may count toward a concrete example; indicating management
        awareness may count toward prior escalation). The combined narrative and form context are considered
        before a template is shown.
      </p>

      <p className={styles.p}>
        <strong>Step three — question generation.</strong> Once the highest-priority gap is identified, the
        system uses the corresponding template — written to ask for <strong>specific, recordable details</strong>{' '}
        (e.g. who, when, channel, outcome), and to invite &ldquo;already provided&rdquo; if the answer is already
        in the free text — and presents that text to the reporter as the targeted follow-up. If no gaps are
        found, or a gap is suppressed because structured form answers already cover that theme, the follow-up
        may be skipped and the reporter moves to the next step.
      </p>

      <DocCallout variant="teal">
        <p>
          <strong>Why only one question?</strong> A reporter disclosing harassment or bullying is already in
          a vulnerable position. Being confronted with five follow-up questions in sequence would feel like
          an interrogation. One targeted, well-chosen question is maximally useful with minimal additional
          burden on the reporter.
        </p>
      </DocCallout>

      <p className={styles.p}>
        The remaining gaps — those not surfaced to the reporter — are passed to the investigator as a ranked
        list. This gives investigators a clear picture of what the report still lacks, and what they may need
        to pursue if they take the case forward.
      </p>
    </section>
  )
}
