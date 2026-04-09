import styles from '../doc.module.css'

export function DocIntroduction(): JSX.Element {
  return (
    <section id="introduction" className={styles.section}>
      <h2 className={styles.h2}>Introduction</h2>
      <p className={styles.p}>
        ClearPath is a prototype internal reporting platform built for 3M. It gives employees a structured,
        confidential channel to report workplace misconduct — including harassment, bullying, and conduct that
        falls outside 3M's Code of Conduct — while giving investigators everything they need to act from the
        moment a case lands.
      </p>
      <p className={styles.p}>
        Most reporting platforms are passive: they collect what the reporter submits and hand it to an
        investigator as-is. ClearPath is active. Between the moment a reporter clicks submit and the moment an
        investigator opens a case, ClearPath's AI pipeline has already read the report, identified what
        critical information is missing, asked one targeted clarifying question, and located the relevant
        section of 3M's own policy documentation. All of this happens automatically, in the background,
        before any human reviews the submission.
      </p>
      <p className={styles.p}>
        The result is higher-quality reports, faster investigations, and a significantly less burdensome
        experience for people who are often in a difficult position when they choose to come forward.
      </p>
    </section>
  )
}
