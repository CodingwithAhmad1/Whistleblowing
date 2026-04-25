import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocAnalysis(): JSX.Element {
  return (
    <section id="analysis" className={styles.section}>
      <h2 className={styles.h2}>AI analysis — how it works and how it is presented</h2>
      <p className={styles.p}>
        The AI analysis shown to investigators is generated at the moment of submission and stored as a fixed
        snapshot alongside the report. It does not re-run when the report is opened and does not change over
        time. This is intentional: the analysis reflects the state of the report as filed, which ensures
        consistency across multiple reviewers and prevents discrepancies if the AI model is updated or
        behaves differently in the future.
      </p>

      <h3 className={styles.h3}>What the analysis contains</h3>
      <p className={styles.p}>
        The analysis is organised into three parts. First, a <strong>neutral incident summary</strong>: a
        concise, factual restatement of what the reporter described. This is not an editorial interpretation —
        it is a condensed version of the Q1 narrative and form fields, written to be quickly scannable by an
        investigator opening a case for the first time.
      </p>
      <p className={styles.p}>
        Second, the <strong>gap analysis</strong>: a status reading for each configured gap rule evaluated
        during the pipeline (the default set has five). Each is shown as either present (sufficient information
        was provided) or missing (a gap was identified). The dimension that was surfaced to the reporter as the
        targeted follow-up is highlighted.
        The remaining gaps — those not asked about — are listed in priority order so the investigator knows
        exactly what to pursue if they take the case further.
      </p>
      <p className={styles.p}>
        Third, the <strong>policy match</strong>: the exact excerpt retrieved from 3M's policy documentation,
        labelled with its source section. If no relevant section cleared the quality threshold, this is clearly
        noted — the system will not fabricate or force a low-confidence match.
      </p>

      <h3 className={styles.h3}>What the analysis is not</h3>
      <DocCallout variant="amber">
        <p>
          <strong>The AI does not determine whether a report is credible, valid, or actionable.</strong> It
          organises and surfaces information — it does not pass judgement on the reporter or the reported
          conduct. All substantive decisions about how to proceed with a case remain entirely with the
          investigator.
        </p>
      </DocCallout>
    </section>
  )
}
