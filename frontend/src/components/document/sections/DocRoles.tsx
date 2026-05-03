import styles from '../doc.module.css'

export function DocRoles(): JSX.Element {
  return (
    <section id="roles-access" className={styles.section}>
      <h2 className={styles.h2}>Roles and navigation</h2>
      <p className={styles.p}>
        ReportIQ supports three modes from the app header. The mode sets typography and which links appear in
        the navigation bar; it does not change report data.
      </p>
      <ul className={styles.benefitList}>
        <li>
          <span className={styles.benefitIcon}>→</span>
          <strong>Reporter</strong> — Home only. Completes the whistleblowing form and exports or submits.
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          <strong>Investigator</strong> — Home and <strong>Feed</strong> (submitted reports, Report and
          Summary tabs).
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          <strong>Manager</strong> — Home, Feed, <strong>Admin</strong> (gap configuration, Gemini check,
          pipeline diagnostics), and this <strong>Document</strong> overview.
        </li>
      </ul>
      <p className={styles.p}>
        The separate <strong>Analysis</strong> page (<code>/analysis</code>) is available from the home flow
        for a read-only view of the last intake run stored in the browser; investigators primarily use the
        Feed for case review.
      </p>
    </section>
  )
}
