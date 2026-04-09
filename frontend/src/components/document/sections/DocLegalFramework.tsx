import styles from '../doc.module.css'

export function DocLegalFramework() {
  return (
    <section id="legal" className={styles.section}>
      <h2 className={styles.h2}>Legal framework</h2>
      <p className={styles.p}>
        ClearPath's design is consistent with established whistleblower protection frameworks. Key reference
        points for 3M's operating jurisdictions include:
      </p>

      <blockquote className={styles.blockquote}>
        Organisations must provide secure, confidential channels through which employees can report misconduct
        without fear of retaliation, and must ensure reports are handled by appropriately trained personnel.
        <cite>— EU Whistleblower Protection Directive (2019/1937), core requirements</cite>
      </blockquote>

      <blockquote className={styles.blockquote}>
        Federal Law No. 4 of 2016 (UAE) establishes protections for individuals reporting violations within
        regulated entities, with confidentiality of reporter identity as a baseline obligation.
        <cite>— UAE Federal Law No. 4 of 2016</cite>
      </blockquote>

      <p className={styles.p}>
        ClearPath supports compliance with both frameworks through its anonymity controls, restricted access
        model (only authorised investigators see submissions), and local data processing. Any production
        deployment should be reviewed by 3M's legal counsel against applicable jurisdiction-specific
        requirements.
      </p>
    </section>
  )
}
