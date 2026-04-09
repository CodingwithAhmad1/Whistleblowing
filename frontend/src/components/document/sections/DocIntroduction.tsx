import styles from '../doc.module.css'

export function DocIntroduction() {
  return (
    <section id="introduction" className={styles.section}>
      <h2 className={styles.h2}>Introduction</h2>
      <p className={styles.p}>
        ClearPath is a prototype internal reporting platform purpose-built for 3M. It gives employees a
        structured, confidential channel to report workplace misconduct — including harassment, bullying, and
        conduct that falls outside 3M's Code of Conduct — and gives investigators the information they need
        to act, from the moment a report lands.
      </p>
      <p className={styles.p}>
        The platform is not simply a form. Between the moment a reporter clicks submit and the moment an
        investigator opens a case, ClearPath's AI pipeline has already read the report, identified what is
        missing, asked one targeted clarifying question, and matched the incident to the relevant section of
        3M's own policy documentation. All of this happens automatically, in the background, before any human
        reviews the submission.
      </p>
    </section>
  )
}
