import styles from '../doc.module.css'

export function DocWhoItServes(): JSX.Element {
  return (
    <section id="who-it-serves" className={styles.section}>
      <h2 className={styles.h2}>Who it serves</h2>
      <div className={styles.cardRow}>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#1d4ed8' }}>
            Reporter
          </div>
          <div className={styles.cardTitle}>The employee</div>
          <p className={styles.cardDesc}>
            Files a report through a guided multi-section form. Inside Full Details, the intake pipeline runs in
            the background: up to two template follow-ups, then a short case summary, policy retrieval, and a
            final policy question before review and submit. Anonymity controls are built in throughout.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#0f766e' }}>
            Investigator
          </div>
          <div className={styles.cardTitle}>HR or legal counsel</div>
          <p className={styles.cardDesc}>
            Uses the <strong>Feed</strong> to review submissions (server-backed when the API is available, with
            browser storage as fallback). Each case can show an extraction breakdown, gap list, and matched
            policy excerpt on the Summary tab.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#b45309' }}>
            Admin / Manager
          </div>
          <div className={styles.cardTitle}>Platform configuration</div>
          <p className={styles.cardDesc}>
            Edits intake gap rules and templates, runs Gemini connectivity checks, and uses pipeline diagnostics
            to validate extraction, gaps, case summary, and RAG steps end-to-end. Managers also have this
            Document page for stakeholder orientation.
          </p>
        </div>
      </div>
    </section>
  )
}
