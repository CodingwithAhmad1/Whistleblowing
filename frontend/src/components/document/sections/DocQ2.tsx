import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

const GAP_ROWS = [
  { color: '#ef4444', priority: 1, gap: 'Timeline unclear', check: 'Can the sequence of events be reconstructed?' },
  { color: '#f97316', priority: 2, gap: 'No specific example', check: 'Is at least one concrete incident described?' },
  { color: '#eab308', priority: 3, gap: 'No evidence referenced', check: 'Are emails, messages, or documents mentioned?' },
  { color: '#84cc16', priority: 4, gap: 'Date missing', check: 'Are explicit dates present in the narrative?' },
  { color: '#22c55e', priority: 5, gap: 'No individuals named', check: 'Are specific people mentioned by name?' },
  { color: '#06b6d4', priority: 6, gap: 'Location missing', check: 'Is a specific place referenced?' },
  { color: '#6366f1', priority: 7, gap: 'Narrative too short', check: 'Is the narrative above a minimum length?' },
]

export function DocQ2() {
  return (
    <section id="q2" className={styles.section}>
      <h3 className={styles.h3}>Q2 — The AI-generated follow-up</h3>
      <p className={styles.p}>
        Once the reporter completes Q1, the system analyses the narrative automatically. This analysis has three
        steps, which happen in the background while the reporter moves to the next screen.
      </p>

      <p className={styles.p}>
        <strong>Step one — extraction.</strong> The AI reads the Q1 narrative and the earlier form fields
        together. It produces a structured summary: which specific people are mentioned, whether a clear timeline
        can be reconstructed, whether concrete examples are described, whether any evidence is referenced, and so
        on. Think of this as the AI building a checklist of what the report does and does not contain.
      </p>

      <p className={styles.p}>
        <strong>Step two — gap detection.</strong> A set of rules — configured by the platform manager — checks
        that checklist. Seven gap types are evaluated, in priority order. The system identifies the single most
        important piece of missing information and only asks about that. It does not interrogate the reporter
        with multiple questions.
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
        Crucially, the system is context-aware. If the reporter already answered "when did this occur?" in the
        earlier form fields, the system will not ask about dates again in Q2, even if the Q1 narrative lacks
        explicit dates. It reads what has already been provided before deciding what to ask.
      </p>

      <p className={styles.p}>
        <strong>Step three — question generation.</strong> Once the highest-priority gap is identified, the
        system retrieves the corresponding question template and presents it to the reporter as Q2. If no gaps
        are found — if the narrative is sufficiently complete — Q2 is skipped entirely and the reporter moves
        directly to Q3.
      </p>

      <DocCallout variant="teal">
        <p>
          <strong>Why only one question?</strong> A reporter disclosing harassment or bullying is already in a
          vulnerable position. Being asked five follow-up questions in sequence would feel like an interrogation.
          One targeted, well-chosen question is maximally useful with minimal additional burden.
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
