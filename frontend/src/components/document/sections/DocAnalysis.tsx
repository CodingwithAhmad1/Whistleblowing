import styles from '../doc.module.css'
import { DocCallout } from '../DocCallout'

export function DocAnalysis(): JSX.Element {
  return (
    <section id="analysis" className={styles.section}>
      <h2 className={styles.h2}>AI analysis — how it works and how it is presented</h2>
      <p className={styles.p}>
        The briefing investigators see on the Summary tab reflects data captured when the reporter completed Full
        Details and submitted the overall form. It is stored alongside the submission so opening a row later does
        not re-run Gemini or RAG — a deliberate choice for consistency if models or prompts change downstream.
      </p>

      <h3 className={styles.h3}>What the analysis contains</h3>
      <p className={styles.p}>
        First, a <strong>neutral incident summary</strong>: a concise restatement of what was filed, meant for a
        quick first read — not a credibility judgement.
      </p>
      <p className={styles.p}>
        Second, the <strong>gap analysis</strong>: each configured gap (five defaults) is shown as satisfied or
        outstanding relative to the merged Layer 1 output. Up to two gaps may have been turned into templates
        for the reporter; those are highlighted so reviewers see both what was asked and what remains latent in
        the configuration.
      </p>
      <p className={styles.p}>
        Third, the <strong>policy match</strong>: excerpt text and source section when the RAG stack returned a
        passage above the relevance threshold; otherwise the UI records that no high-confidence section was
        identified rather than fabricating a quote.
      </p>
      <p className={styles.p}>
        When available, an <strong>extraction breakdown</strong> separates rule-based signals from model
        inference, which helps reviewers understand why a boolean flipped without re-running the model.
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
