import styles from '../doc.module.css'

export function DocLegalFramework(): JSX.Element {
  return (
    <section id="legal" className={styles.section}>
      <h2 className={styles.h2}>Legal framework</h2>
      <p className={styles.p}>
        ClearPath's design is consistent with established whistleblower protection frameworks across 3M's
        key operating jurisdictions. Two frameworks are particularly relevant:
      </p>

      <blockquote className={styles.blockquote}>
        Organisations must provide secure, confidential channels through which employees can report misconduct
        without fear of retaliation, and must ensure reports are handled by appropriately trained personnel.
        <cite>— EU Whistleblower Protection Directive (2019/1937), core requirements</cite>
      </blockquote>

      <blockquote className={styles.blockquote}>
        Federal Law No. 4 of 2016 establishes protections for individuals reporting violations within
        regulated entities, with confidentiality of reporter identity as a baseline obligation.
        <cite>— UAE Federal Law No. 4 of 2016</cite>
      </blockquote>

      <p className={styles.p}>
        ClearPath supports compliance with both frameworks through its anonymity controls, restricted
        investigator access (only authorised personnel can view submissions), and the separation of reporter
        identity from case content.
      </p>
      <p className={styles.p}>
        Compliance is not automatic, however. The data processing considerations outlined in the previous
        section — particularly around AI services and third-party data transmission — have direct legal
        implications that would need to be resolved before any production deployment. Any live rollout should
        be reviewed by 3M's legal counsel against applicable jurisdiction-specific requirements.
      </p>
    </section>
  )
}
