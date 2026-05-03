import styles from '../doc.module.css'

export function DocLegalFramework(): JSX.Element {
  return (
    <section id="legal" className={styles.section}>
      <h2 className={styles.h2}>Legal framework</h2>
      <p className={styles.p}>
        ReportIQ&apos;s UX patterns align with common whistleblower protection expectations in jurisdictions
        such as those highlighted in a 3M-oriented deployment narrative. Two frameworks are often cited in that
        context:
      </p>

      <blockquote className={styles.blockquote}>
        Organisations must provide secure, confidential channels through which employees can report misconduct
        without fear of retaliation, and must ensure reports are handled by appropriately trained personnel.
        <cite>— EU Whistleblower Protection Directive (2019/1937), core requirements</cite>
      </blockquote>

      <blockquote className={styles.blockquote}>
        Federal Law No. 4 of 2016 establishes protections for individuals reporting violations within regulated
        entities, with confidentiality of reporter identity as a baseline obligation.
        <cite>— UAE Federal Law No. 4 of 2016</cite>
      </blockquote>

      <p className={styles.p}>
        ReportIQ supports alignment with those themes through anonymity controls, investigator-only visibility of
        submissions in the prototype&apos;s intended workflow, and clear separation between case content and
        optional identity fields.
      </p>
      <p className={styles.p}>
        Compliance is not automatic. AI vendor usage, data residency, and retention must be reviewed with counsel
        before any live rollout covering real employees.
      </p>
    </section>
  )
}
