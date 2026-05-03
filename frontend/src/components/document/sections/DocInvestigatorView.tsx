import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocInvestigatorView(): JSX.Element {
  return (
    <section id="investigator-view" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>What investigators see</h2>
      <p className={styles.p}>
        Investigators open the <strong>Feed</strong> (<code>/feed</code>), which lists submitted reports in
        reverse-chronological order. When the FastAPI backend is running, rows are loaded from{' '}
        <code>GET /api/submissions</code> so multiple browsers share the same queue; if the API is offline, the
        UI falls back to local browser storage until connectivity returns.
      </p>
      <p className={styles.p}>
        Each row shows reference, submission time, and whether the reporter identified themselves or chose
        anonymity. Expanding a row opens <strong>Report</strong> and <strong>Summary</strong> tabs.
      </p>

      <h3 className={styles.h3}>Report tab</h3>
      <p className={styles.p}>
        Read-only answers for structured sections, the Full Details narrative (
        <code>full_details_q1</code>), up to two gap follow-up question-and-answer pairs when present, the
        constructed case summary where stored, policy excerpt and section metadata, and the fixed policy question
        with the reporter&apos;s reply. Skipped steps and empty fields are visible states, not silent omissions.
      </p>

      <h3 className={styles.h3}>Summary tab</h3>
      <p className={styles.p}>
        The briefing captured at submission typically includes:
      </p>
      <ul className={styles.benefitList}>
        <li>
          <span className={styles.benefitIcon}>→</span>
          A neutral incident summary derived from the filed content
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          Gap coverage across configured dimensions (default five), with emphasis on the gaps surfaced to the
          reporter when applicable
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          Model vs form-backed <strong>extraction breakdown</strong>, when the stored submission includes it
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          Policy excerpt and section label when RAG succeeded; otherwise an explicit &ldquo;no match&rdquo;
          style state
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          Remaining investigative prompts implied by the gap list
        </li>
      </ul>

      <DocCallout variant="teal">
        <p>
          <strong>For investigators:</strong> by the time a report is opened, much of the preparatory reading and
          policy lookup work is already packaged. The investigator&apos;s role is to assess and act — not to
          reconstruct the filing flow by hand.
        </p>
      </DocCallout>

      <p className={styles.p}>
        For debugging or training, <code>/analysis</code> can replay the last intake JSON stored in session
        storage from the current browser; operational review should rely on Feed rows tied to submissions.
      </p>
    </section>
  )
}
