import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ3(): JSX.Element {
  return (
    <section id="q3" className={styles.section}>
      <h3 className={styles.h3}>Q3 — The policy match</h3>
      <p className={styles.p}>
        After Q2, the system performs an independent operation: it searches 3M's internal policy documentation
        to find the section most relevant to the reported incident. This runs automatically, with no input
        required from the reporter.
      </p>

      <p className={styles.p}>
        <strong>How the policy search works.</strong> Rather than matching on keywords, the system first
        distils the entire report — all form fields, the Q1 narrative, and the Q2 response — into a single
        compact sentence that captures the essential nature of the incident. That sentence is then compared
        against 3M's policy document, which has been pre-processed and indexed by the system in advance.
      </p>
      <p className={styles.p}>
        The comparison works by measuring conceptual similarity rather than word overlap. A report about
        being pressured not to raise concerns — even if the word "retaliation" never appears — will match
        the relevant policy clause on retaliation, because the system understands meaning rather than just
        vocabulary. Eight candidate sections are retrieved and each is independently scored for relevance
        on a scale of 1 to 5. Only sections scoring 3 or above are considered; the highest-scoring match
        is returned. If no candidate clears the threshold, the system records that no directly relevant
        section was found — it will not force a poor match.
      </p>

      <DocCallout variant="blue">
        <p>
          <strong>In plain terms:</strong> the system reads the report, understands what kind of incident is
          being described, and automatically retrieves the exact passage from 3M's Code of Conduct that
          applies to it — without anyone having to search for it manually.
        </p>
      </DocCallout>

      <p className={styles.p}>
        Q3 presents the reporter with the matched policy excerpt alongside a single question: does the
        described conduct align with this policy? The reporter's response — together with the policy excerpt
        itself — is stored in the report and surfaced to the investigator.
      </p>
      <p className={styles.p}>
        This means investigators open a case already knowing which policy clause is in play, removing one of
        the most time-consuming steps in early-stage case assessment.
      </p>
    </section>
  )
}
