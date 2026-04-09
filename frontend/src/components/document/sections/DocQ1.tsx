import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ1(): JSX.Element {
  return (
    <section id="q1" className={styles.section}>
      <h3 className={styles.h3}>Q1 — The reporter's narrative</h3>
      <p className={styles.p}>
        Q1 is a free-text field. The reporter is asked to describe the incident in their own words, with no
        imposed structure. This is an intentional design decision: structured prompts — "describe the date,"
        "name the individuals involved," "list your evidence" — can feel clinical and interrogative,
        particularly for someone disclosing a sensitive or distressing experience. A free narrative is
        lower-friction and consistently produces richer, more authentic detail.
      </p>
      <p className={styles.p}>
        The structural work — extracting who is involved, what happened, when, where, and whether evidence
        exists — is handled entirely by the AI pipeline. The reporter's only task at Q1 is to write.
      </p>

      <DocCallout variant="blue">
        <p>
          <strong>The absence of structure in Q1 is not a gap in the design — it is the design.</strong> A
          reporter who feels they are filling out a bureaucratic checklist is less likely to share the
          detail that makes a case actionable. One who feels simply heard is more likely to.
        </p>
      </DocCallout>

      <p className={styles.p}>
        Q1 is also where most of the investigator-relevant information originates. Everything that follows —
        the gap analysis, the AI-generated follow-up question, the policy match — is derived from what the
        reporter writes here. Getting Q1 right is the foundation of the entire pipeline.
      </p>
    </section>
  )
}
