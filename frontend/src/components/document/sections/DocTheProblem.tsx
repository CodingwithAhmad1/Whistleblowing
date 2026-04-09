import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocTheProblem(): JSX.Element {
  return (
    <section id="the-problem" className={styles.section}>
      <h2 className={styles.h2}>The problem it solves</h2>
      <p className={styles.p}>
        Most misconduct reports arrive incomplete. Not because reporters are withholding information — but
        because recalling and articulating a distressing experience under pressure is genuinely difficult.
        Someone describing a bullying incident might remember exactly how it felt but struggle to pin down
        specific dates, name every person involved, or recall whether they have any evidence. These omissions
        are normal and expected.
      </p>
      <p className={styles.p}>
        The conventional response is a back-and-forth loop: the investigator reads the report, spots the gaps,
        and sends a follow-up request. The reporter — already in a vulnerable position — has to re-engage,
        re-explain, and in many cases re-live the experience. This cycle delays resolution and places unnecessary
        administrative load on HR and legal teams that are already stretched.
      </p>

      <DocCallout variant="amber">
        <p><strong>The core insight:</strong> if we can identify what is missing at the point of submission —
        and ask just one targeted question before the report is filed — we dramatically improve the quality of
        every case that reaches an investigator, without adding meaningful burden to the reporter.</p>
      </DocCallout>

      <p className={styles.p}>By the time an investigator opens a ClearPath report, they already have:</p>

      <ul className={styles.benefitList}>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A structured, AI-produced summary of the incident
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A complete gap analysis — what the report covers and what is still missing
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          The most relevant section of 3M's policy documentation, automatically retrieved and matched to the case
        </li>
        <li>
          <span className={styles.benefitIcon}>✓</span>
          A ranked list of remaining follow-up questions if the investigation needs to go further
        </li>
      </ul>

      <p className={styles.p}>
        Fewer back-and-forth exchanges. Faster case resolution. A less burdensome experience for reporters.
      </p>
    </section>
  )
}
