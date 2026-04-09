import styles from '../doc.module.css'

export function DocWhoItServes(): JSX.Element {
  return (
    <section id="who-it-serves" className={styles.section}>
      <h2 className={styles.h2}>Who it serves</h2>
      <div className={styles.cardRow}>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#1d4ed8' }}>Reporter</div>
          <div className={styles.cardTitle}>The employee</div>
          <p className={styles.cardDesc}>
            Files a report through a clean, guided form. The AI pipeline works entirely in the background —
            the reporter simply writes, answers one or two questions, and submits. Anonymity controls are
            built in throughout.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#0f766e' }}>Investigator</div>
          <div className={styles.cardTitle}>HR or legal counsel</div>
          <p className={styles.cardDesc}>
            Reviews an organised feed of submitted reports. Every case arrives pre-loaded with a structured
            AI summary, gap analysis, and matched policy excerpt — the preparatory work is already done
            before they open the case.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#b45309' }}>Admin</div>
          <div className={styles.cardTitle}>Platform administrator</div>
          <p className={styles.cardDesc}>
            Configures the gap-detection rules that govern which questions the AI asks, monitors AI model
            health, and manages platform-wide settings. No technical background required.
          </p>
        </div>
      </div>
    </section>
  )
}
