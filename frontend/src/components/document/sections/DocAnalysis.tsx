import styles from '../doc.module.css'

export function DocAnalysis() {
  return (
    <section id="analysis" className={styles.section}>
      <h2 className={styles.h2}>AI analysis — how it is presented</h2>
      <p className={styles.p}>
        The analysis displayed to investigators is a snapshot taken at the moment of submission. It does not
        re-run when the report is opened. This is intentional: the analysis reflects the state of the report
        as filed, ensuring consistency across reviews and preventing discrepancies if AI model behaviour changes
        over time.
      </p>

      <p className={styles.p}>
        The gap status for each of the seven dimensions is displayed clearly: green where information is present
        and sufficient, red where a gap was identified. The investigator can see at a glance both what was asked
        of the reporter (Q2) and what gaps remain open for follow-up.
      </p>
    </section>
  )
}
