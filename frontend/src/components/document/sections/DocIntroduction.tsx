import styles from '../doc.module.css'

export function DocIntroduction(): JSX.Element {
  return (
    <section id="introduction" className={styles.section}>
      <h2 className={styles.h2}>Introduction</h2>
      <p className={styles.p}>
        ReportIQ is a prototype internal reporting application. In a deployment scenario framed around 3M
        policy material, it gives employees a structured, confidential channel to report workplace misconduct
        while giving investigators a concise package the moment a case lands.
      </p>
      <p className={styles.p}>
        Most reporting platforms are passive: they collect what the reporter submits and hand it to an
        investigator as-is. ReportIQ adds an active pipeline. After the narrative and incident context are
        captured, the system runs intake analysis in the background, may surface <strong>up to two</strong>{' '}
        gap-driven follow-ups (admin-configured templates), then builds a short <strong>case summary</strong>{' '}
        sentence and runs <strong>policy retrieval</strong> against indexed conduct policy before the final
        policy question and submit. Much of that work completes before any human opens the submission.
      </p>
      <p className={styles.p}>
        The result is higher-quality reports, faster investigations, and a significantly less burdensome
        experience for people who are often in a difficult position when they choose to come forward.
      </p>
    </section>
  )
}
