import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ1(): JSX.Element {
  return (
    <section id="q1" className={styles.section}>
      <h3 className={styles.h3}>Q1 — The reporter&apos;s narrative</h3>
      <p className={styles.p}>
        Q1 is a free-text field. The reporter is asked to describe the incident in their own words, with no
        imposed structure. This is an intentional design decision: structured prompts — &ldquo;describe the
        date,&rdquo; &ldquo;name the individuals involved,&rdquo; &ldquo;list your evidence&rdquo; — can feel
        clinical and interrogative, particularly for someone disclosing a sensitive or distressing experience. A
        free narrative is lower-friction and consistently produces richer, more authentic detail.
      </p>
      <p className={styles.p}>
        The structural work — extracting who is involved, examples, timeline clarity, witnesses, and so on — is
        performed in Layer 1 using the narrative <strong>plus</strong> labeled content from other incident and
        Full Details fields the reporter has already filled. The reporter&apos;s only task at Q1 is to write;
        the backend still benefits from chronology, sequence-of-events, and evidence-description answers when
        those exist.
      </p>

      <DocCallout variant="blue">
        <p>
          <strong>The absence of structure in Q1 is not a gap in the design — it is the design.</strong> A
          reporter who feels they are filling out a bureaucratic checklist is less likely to share the detail
          that makes a case actionable. One who feels simply heard is more likely to.
        </p>
      </DocCallout>

      <p className={styles.p}>
        Q1 is also where most of the investigator-relevant information originates. Everything that follows —
        gap analysis, template follow-ups, the case summary, and policy retrieval — is derived from the combined
        report state. Getting Q1 (and the surrounding incident fields) right is the foundation of the pipeline.
      </p>
    </section>
  )
}
