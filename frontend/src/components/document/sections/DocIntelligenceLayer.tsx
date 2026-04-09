import styles from '../doc.module.css'

export function DocIntelligenceLayer(): JSX.Element {
  return (
    <section id="final-section" className={styles.section}>
      <h2 className={styles.h2}>The intelligence layer</h2>
      <p className={styles.p}>
        The three questions in the Full Details section are not independent — they are connected by a pipeline
        that runs automatically in the background. Below is that pipeline in full, from the reporter's first
        keystroke to the moment the report lands with an investigator.
      </p>

      <div className={styles.pipeline}>
        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Q1 — Free-text narrative</span>
          </div>
          <p className={styles.pipelineStepBody}>The reporter describes the incident in their own words. No imposed structure, no leading prompts.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepAI}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeAI}`}>AI — Layer 1</span>
            <span className={styles.pipelineStepTitle}>Extraction</span>
          </div>
          <p className={styles.pipelineStepBody}>The AI reads the narrative alongside all form fields and builds a structured internal checklist: who is named, whether a timeline can be reconstructed, whether concrete examples or evidence are referenced, and so on.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepAI}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeAI}`}>AI — Layer 2</span>
            <span className={styles.pipelineStepTitle}>Gap detection</span>
          </div>
          <p className={styles.pipelineStepBody}>Seven configurable gap rules are evaluated in priority order against the checklist. The system identifies the single most critical missing piece of information. If the narrative is already sufficiently complete, no gap is raised and Q2 is skipped.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepAI}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeAI}`}>AI — Layer 3</span>
            <span className={styles.pipelineStepTitle}>Question generation</span>
          </div>
          <p className={styles.pipelineStepBody}>A targeted follow-up question (Q2) is generated from a template matched to the identified gap and surfaced to the reporter.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Q2 — Targeted follow-up</span>
          </div>
          <p className={styles.pipelineStepBody}>One question, chosen specifically based on what this report was missing. The reporter answers it, or moves on if Q2 was skipped.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSystem}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSystem}`}>System</span>
            <span className={styles.pipelineStepTitle}>Policy search</span>
          </div>
          <p className={styles.pipelineStepBody}>The full report is distilled into a compact summary sentence. That summary is compared against 3M's indexed policy document using semantic search — matching by meaning, not keywords — and the most relevant excerpt is retrieved and scored for quality.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Q3 — Policy confirmation</span>
          </div>
          <p className={styles.pipelineStepBody}>The retrieved policy excerpt is shown to the reporter alongside a single question: does the described conduct align with this policy? The reporter's response is recorded alongside the excerpt.</p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSubmit}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSubmit}`}>Filed</span>
            <span className={styles.pipelineStepTitle}>Report submitted — investigator package ready</span>
          </div>
          <p className={styles.pipelineStepBody}>The report arrives in the investigator feed pre-packaged with the full narrative, AI analysis, gap summary, matched policy excerpt, and a ranked list of remaining follow-up questions.</p>
        </div>
      </div>

      <p className={styles.p}>
        The pipeline is resilient by design. If any AI step fails — due to a network interruption or an
        unexpected model response — the form continues and the reporter can still submit. No failure silently
        drops a report.
      </p>
    </section>
  )
}
