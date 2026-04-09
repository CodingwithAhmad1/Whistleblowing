import styles from '../doc.module.css'

export function DocDataPrivacy() {
  return (
    <section id="data-privacy" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>Data and privacy</h2>
      <p className={styles.p}>
        ClearPath is designed for deployment within 3M's own environment. The AI processing — the gap analysis,
        the policy search, the summary generation — runs locally. Submission data does not leave 3M's
        infrastructure, and no third-party service receives report content.
      </p>

      <p className={styles.p}>
        Reporter anonymity is handled at the form level. Reporters may choose to submit anonymously; if they
        do, their identity is not stored anywhere in the system. If they choose to provide their name, it is
        stored only within the submission record and is visible solely to authorised investigators.
      </p>

      <p className={styles.p}>
        The current prototype stores submissions in local browser storage for demonstration purposes. A
        production deployment would integrate with 3M's existing secure data infrastructure.
      </p>
    </section>
  )
}
