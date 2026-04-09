import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocInvestigatorView(): JSX.Element {
  return (
    <section id="investigator-view" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>What investigators see</h2>
      <p className={styles.p}>
        Investigators access ClearPath through a dedicated view — the Feed — which lists all submitted
        reports in reverse-chronological order. Each row shows the case reference number, the date and time
        of submission, and the reporter's name or an anonymity indicator if they chose not to disclose their
        identity.
      </p>
      <p className={styles.p}>
        Clicking on any report opens it into a two-tab view.
      </p>

      <h3 className={styles.h3}>Report tab</h3>
      <p className={styles.p}>
        A read-only display of everything the reporter submitted: all structured form fields (nature of
        incident, location, date, witnesses, anonymity preference), the Q1 narrative, the Q2 follow-up
        question and the reporter's response, and the Q3 policy question and response. Fields left blank or
        questions that were skipped are clearly indicated rather than silently omitted. The layout is designed
        for reading — clean and uncluttered, with no input boxes.
      </p>

      <h3 className={styles.h3}>Summary tab</h3>
      <p className={styles.p}>
        The AI-generated analysis of the report, presented as a structured briefing. This includes:
      </p>
      <ul className={styles.benefitList}>
        <li>
          <span className={styles.benefitIcon}>→</span>
          A neutral, factual summary of the incident as described by the reporter
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          The full gap analysis — all seven dimensions, each marked as present or missing
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          The matched policy excerpt, labelled with its source section from 3M's Code of Conduct
        </li>
        <li>
          <span className={styles.benefitIcon}>→</span>
          A prioritised list of remaining follow-up questions for the investigator to pursue if the case progresses
        </li>
      </ul>

      <DocCallout variant="teal">
        <p>
          <strong>For investigators:</strong> by the time a report is opened, the preparatory work is done.
          The AI has read the report, identified what is strong and what is missing, matched the relevant
          policy, and organised everything into a briefing. The investigator's role is to assess and act —
          not to prepare.
        </p>
      </DocCallout>
    </section>
  )
}
