import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocInvestigatorView() {
  return (
    <section id="investigator-view" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>What investigators see</h2>
      <p className={styles.p}>
        Investigators access ClearPath through a dedicated view — the Feed — which shows a table of all
        submitted reports. Each report is identified by a case number, the reporter's identity or anonymity
        status, and the date and time of submission.
      </p>

      <p className={styles.p}>Clicking on any report expands it to reveal two tabs.</p>

      <h3 className={styles.h3}>Report tab</h3>
      <p className={styles.p}>
        A clean, read-only display of everything the reporter submitted: all form fields, the Q1 narrative, the
        Q2 follow-up question and response, and the Q3 policy question and response. Unanswered questions are
        clearly marked. The layout mirrors the form's structure but is purpose-built for reading rather than
        filling in — no input boxes, no distractions.
      </p>

      <h3 className={styles.h3}>Summary tab</h3>
      <p className={styles.p}>
        The AI-generated analysis of the report, presented as a structured briefing. This includes the AI's
        neutral summary of the incident, the full gap analysis with each gap ranked by priority, the matched
        policy excerpt, and the list of remaining follow-up questions the investigator may wish to pursue.
      </p>

      <DocCallout variant="teal">
        <p>
          <strong>For investigators:</strong> by the time a report is opened, the background work is done. The
          AI has read the report, identified what is strong and what is missing, matched the relevant policy,
          and organised everything into a structured briefing. The investigator's job is to assess and act —
          not to prepare.
        </p>
      </DocCallout>
    </section>
  )
}
