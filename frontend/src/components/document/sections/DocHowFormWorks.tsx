import styles from '../doc.module.css'

export function DocHowFormWorks(): JSX.Element {
  return (
    <section id="how-form-works" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>How the form works</h2>
      <p className={styles.p}>
        The reporting form has two parts. The first collects structured context: the nature of the incident,
        where and when it occurred, whether there were witnesses, and the reporter's identity or anonymity
        preference. These fields use dropdowns and short text inputs — they are quick to complete and feed
        directly into the AI pipeline as supporting context alongside the narrative.
      </p>
      <p className={styles.p}>
        The second part is the <strong>Full Details section</strong> — where ClearPath's intelligence does its
        work. It contains three questions, each serving a distinct purpose and each built on what came before it.
      </p>

      <div className={styles.stepFlow}>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>Q1</span>
          Reporter narrative
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumAI}`}>AI</span>
          Gap analysis
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>Q2</span>
          Targeted follow-up
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumAI}`}>AI</span>
          Policy search
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={styles.stepNum}>Q3</span>
          Policy question
        </div>
        <span className={styles.stepArrow}>→</span>
        <div className={styles.stepPill}>
          <span className={`${styles.stepNum} ${styles.stepNumGreen}`}>✓</span>
          Submitted
        </div>
      </div>

      <p className={styles.p}>
        The form is not static: it reads the reporter's narrative and responds to it. Each AI step runs in
        the background so the reporter experiences a smooth, linear flow — they never see the analysis
        happening.
      </p>
    </section>
  )
}
