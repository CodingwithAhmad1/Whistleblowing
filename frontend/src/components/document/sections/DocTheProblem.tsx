import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocTheProblem() {
  return (
    <section id="the-problem" className={styles.section}>
      <h2 className={styles.h2}>The problem it solves</h2>
      <p className={styles.p}>
        Most misconduct reports arrive incomplete. The reporter submits what they can recall in the moment; the
        investigator reads it, identifies what is missing, and sends a follow-up. The reporter — already in a
        vulnerable position — has to re-engage, re-explain, and re-live the experience. This back-and-forth
        delays resolution, increases distress for the reporter, and creates administrative overhead for already
        stretched HR and legal teams.
      </p>

      <DocCallout variant="amber">
        <p><strong>The core insight:</strong> If we can identify what is missing at the point of submission —
        and ask just one targeted question before the report is filed — we dramatically improve the quality of
        every case that lands with an investigator.</p>
      </DocCallout>

      <p className={styles.p}>ClearPath addresses this at the source. By the time an investigator opens a report, they have:</p>

      <ul className={styles.benefitList}>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A structured, AI-analysed summary of the incident
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A complete gap analysis — what information is present and what is still missing
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          The most relevant section of 3M's policy documentation, automatically retrieved and matched to the case
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A ranked list of remaining follow-up questions, should they be needed
        </li>
      </ul>

      <p className={styles.p}>
        The result is fewer back-and-forth exchanges, faster case resolution, and a less burdensome experience
        for the reporter.
      </p>
    </section>
  )
}
