import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ3() {
  return (
    <section id="q3" className={styles.section}>
      <h3 className={styles.h3}>Q3 — The policy match</h3>
      <p className={styles.p}>
        After Q2, the system performs a second, independent AI operation: it searches 3M's internal policy
        documentation to find the section most relevant to the reported incident.
      </p>

      <p className={styles.p}>
        This search works by converting the entire report — all form fields and Q1 narrative — into a compact,
        semantically precise summary sentence. That summary is then compared against the policy document, which
        has been pre-processed and indexed by the system. The comparison is not a keyword search; it works by
        measuring the conceptual similarity between the report summary and sections of the policy. The closest
        match is retrieved, re-evaluated for quality, and the relevant excerpt is surfaced.
      </p>

      <DocCallout variant="blue">
        <p>
          <strong>In plain terms:</strong> the system reads the report, understands what kind of incident is
          being described, and finds the exact passage in 3M's Code of Conduct that applies to it —
          automatically, without anyone having to look it up.
        </p>
      </DocCallout>

      <p className={styles.p}>
        Q3 presents the reporter with that policy excerpt alongside a single question: does the described
        conduct align with this policy? The reporter's response to Q3, together with the policy excerpt itself,
        is stored in the report and surfaced to the investigator.
      </p>

      <p className={styles.p}>
        This means investigators arrive at a case already knowing which policy clause is in play — removing one
        of the most time-consuming steps in early-stage case assessment.
      </p>
    </section>
  )
}
