import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ3(): JSX.Element {
  return (
    <section id="q3" className={styles.section}>
      <h3 className={styles.h3}>Policy excerpt and question (&ldquo;Q3&rdquo; in the wizard)</h3>
      <p className={styles.p}>
        After gap follow-ups complete, the client builds a compact case summary (LLM) and calls the policy-quote
        API. The reporter does not type anything during retrieval; they only answer once the excerpt (if any) is
        shown.
      </p>

      <p className={styles.p}>
        <strong>How policy search works.</strong> The constructed sentence (plus form fallbacks when needed) is
        embedded and queried against a Chroma collection of pre-chunked policy text — for example 3M Code of
        Conduct passages. The store returns several nearest neighbours; a similarity floor filters obvious
        mismatches. An LLM re-ranker then scores each remaining chunk from 1–5 for relevance to the case; scores
        below 3 are dropped, and the best surviving chunk yields a cleaned quotation and section label when the
        pipeline succeeds.
      </p>
      <p className={styles.p}>
        The excerpt is <strong>retrieved text</strong> from the indexed document, not a free-form policy essay
        invented by the model. When nothing clears the thresholds, the UI explains that no passage was identified
        and still invites the reporter to comment from their perspective.
      </p>

      <DocCallout variant="blue">
        <p>
          <strong>In plain terms:</strong> the system compares the case summary to meaningfully similar passages
          in the organisation&apos;s policy corpus and surfaces the strongest match for acknowledgement — without
          requiring a manual search at filing time.
        </p>
      </DocCallout>

      <p className={styles.p}>
        The standard prompt shown with the excerpt is:{' '}
        <strong>&ldquo;How well does this policy excerpt describe your experience?&rdquo;</strong> The
        reporter&apos;s response and the excerpt metadata are stored for investigators alongside the rest of the
        submission.
      </p>
      <p className={styles.p}>
        When retrieval succeeds, investigators open the case with a labelled policy reference already attached,
        which removes a common early bottleneck in triage.
      </p>
    </section>
  )
}
