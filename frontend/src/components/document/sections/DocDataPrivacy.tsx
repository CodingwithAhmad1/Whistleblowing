import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocDataPrivacy(): JSX.Element {
  return (
    <section id="data-privacy" className={styles.section}>
      <hr className={styles.hr} />
      <h2 className={styles.h2}>Data and privacy</h2>

      <h3 className={styles.h3}>AI processing and third-party services</h3>
      <p className={styles.p}>
        In the current prototype, ClearPath's AI processing — gap analysis, policy search, and summary
        generation — is powered by Google's Gemini language model, accessed via API. This means report content
        is transmitted to Google's servers during AI processing steps. For a production deployment, 3M would
        need to determine whether this is acceptable under its data governance and legal obligations, or
        configure the platform to use an approved on-premises or enterprise-contracted AI service that keeps
        all data within 3M's own infrastructure.
      </p>

      <DocCallout variant="amber">
        <p>
          <strong>Prototype note:</strong> the current build transmits report content to an external AI API
          for demonstration purposes. Any live deployment handling real employee reports would require either
          a data processing agreement with the AI provider or a switch to an on-premises model.
        </p>
      </DocCallout>

      <h3 className={styles.h3}>Reporter anonymity</h3>
      <p className={styles.p}>
        Anonymity is handled at the form level. Reporters may choose to submit without disclosing their
        identity. If they do, no identifying information is stored anywhere in the system. If they choose to
        provide their name, it is stored only within the submission record and is visible solely to authorised
        investigators — it does not appear in any aggregate view or administrative interface.
      </p>

      <h3 className={styles.h3}>Submission storage</h3>
      <p className={styles.p}>
        The current prototype stores submissions in local browser storage — no server-side database is used.
        This is purely for demonstration. A production deployment would integrate with 3M's existing secure
        data infrastructure, with appropriate access controls, retention policies, and audit logging in place.
      </p>
    </section>
  )
}
