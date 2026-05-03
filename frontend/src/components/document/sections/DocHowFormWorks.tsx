import styles from '../doc.module.css'

export function DocHowFormWorks(): JSX.Element {
  return (
    <section id="how-form-works" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>How the form works</h2>
      <p className={styles.p}>
        The reporting form has two parts. The first collects structured context: organization and incident
        location, the nature of the matter, where and when it occurred, how the reporter became aware,
        people involved, and anonymity preference. These fields feed the intake pipeline as labeled context
        alongside the long-form narrative.
      </p>
      <p className={styles.p}>
        The second part sits under <strong>Incident Details</strong>: the <strong>Full Details</strong>{' '}
        wizard. It starts with the free-text narrative (Q1), then optional gap-driven follow-ups (up to two),
        an automatic <strong>case summary</strong> step, <strong>policy retrieval</strong>, a fixed{' '}
        <strong>policy question</strong> with the excerpt, and finally an editable <strong>review</strong>{' '}
        before the overall form is submitted.
      </p>

      <div className={styles.stepFlow}>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>Q1</span>
          Narrative
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumAI}`}>AI</span>
          Intake
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>0–2</span>
          Gap Qs
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumAI}`}>AI</span>
          Summary
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumAI}`}>RAG</span>
          Policy
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>PQ</span>
          Policy Q
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumGreen}`}>✓</span>
          Review
        </div>
      </div>

      <p className={styles.p}>
        Long-running steps use loading states so the flow feels linear. If intake or policy retrieval fails, the
        reporter can fall back (for example skip and continue where the UI allows) so submissions are not
        silently dropped.
      </p>
    </section>
  )
}
