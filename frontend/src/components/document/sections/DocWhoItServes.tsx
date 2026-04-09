import styles from '../doc.module.css'

export function DocWhoItServes() {
  return (
    <section id="who-it-serves" className={styles.section}>
      <h2 className={styles.h2}>Who it serves</h2>
      <div className={styles.cardRow}>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#1d4ed8' }}>Reporter</div>
          <div className={styles.cardTitle}>The employee</div>
          <p className={styles.cardDesc}>
            Files a report through a clean, guided form. Never sees the analysis. Protected by anonymity controls.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: 'var(--color-text-muted)' }}>Investigator</div>
          <div className={styles.cardTitle}>HR or legal counsel</div>
          <p className={styles.cardDesc}>
            Reviews a feed of submissions. Each submission arrives with a full AI summary, gap analysis, and
            policy match already complete.
          </p>
        </div>
        <div className={styles.card}>
          <div className={styles.cardLabel} style={{ color: '#b91c1c' }}>Manager</div>
          <div className={styles.cardTitle}>Platform administrator</div>
          <p className={styles.cardDesc}>
            Configures the AI gap rules, manages the system, and oversees platform-wide settings.
          </p>
        </div>
      </div>
    </section>
  )
}
