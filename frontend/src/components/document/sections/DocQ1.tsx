import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocQ1() {
  return (
    <section id="q1" className={styles.section}>
      <h3 className={styles.h3}>Q1 — The reporter's narrative</h3>
      <p className={styles.p}>
        Q1 is a free-text field. The reporter is asked to describe the incident in their own words, with no
        imposed structure. This is intentional: structured prompts ("describe the date," "name the individuals")
        can feel clinical and alienating, particularly for reporters describing sensitive experiences. A free
        narrative is lower-friction and tends to surface richer, more authentic detail.
      </p>

      <DocCallout variant="blue">
        <p>
          The absence of structure in Q1 is not a design limitation — it is a deliberate choice. The AI handles
          the structure. The reporter just writes.
        </p>
      </DocCallout>
    </section>
  )
}
