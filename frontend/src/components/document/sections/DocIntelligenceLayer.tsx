import styles from '../doc.module.css'

export function DocIntelligenceLayer(): JSX.Element {
  return (
    <section id="final-section" className={styles.section}>
      <h2 className={styles.h2}>The intelligence layer</h2>
      <p className={styles.p}>
        Full Details is a connected pipeline from the reporter&apos;s narrative through intake, optional
        follow-ups, case summary, policy retrieval, and the policy question. Below is the end-to-end path the
        product implements today.
      </p>

      <div className={styles.pipeline}>
        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Q1 — Free-text narrative</span>
          </div>
          <p className={styles.pipelineStepBody}>
            The reporter describes the incident in their own words. Earlier incident fields (chronology,
            sequence of events, evidence description, etc.) are included in the same submission and are passed
            to the backend as separate labeled blocks when present.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepAI}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeAI}`}>AI — Layer 1</span>
            <span className={styles.pipelineStepTitle}>Extraction</span>
          </div>
          <p className={styles.pipelineStepBody}>
            A Gemini prompt ingests labeled sections — including{' '}
            <strong>NARRATIVE</strong>, <strong>CHRONOLOGY</strong>, <strong>SEQUENCE</strong>,{' '}
            <strong>EVIDENCE_DESCRIPTION</strong>, concealment, how-aware, structured metadata, and follow-up
            answers when they exist — and returns structured JSON (booleans, lists, summary) used as the checklist
            for gaps.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSystem}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSystem}`}>Rules — Layer 2</span>
            <span className={styles.pipelineStepTitle}>Gap detection</span>
          </div>
          <p className={styles.pipelineStepBody}>
            Active gap configurations (default: five) are evaluated in priority order against the merged
            checklist. Conditional rules can suppress specific gaps when form answers already cover the theme
            (for example a long sequence-of-events or management-awareness). At most <strong>two</strong> gap
            ids proceed to the next step; if none fire, follow-ups are skipped.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSystem}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSystem}`}>Templates — Layer 3</span>
            <span className={styles.pipelineStepTitle}>Follow-up text</span>
          </div>
          <p className={styles.pipelineStepBody}>
            No additional LLM call: each selected gap maps to its admin-defined template (trimmed to a maximum
            length), phrased to invite concrete detail and an &ldquo;already provided&rdquo; reply when
            appropriate.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Gap follow-ups (0–2)</span>
          </div>
          <p className={styles.pipelineStepBody}>
            The reporter answers each surfaced template question in sequence, or continues immediately when no
            gaps were selected.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepAI}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeAI}`}>AI</span>
            <span className={styles.pipelineStepTitle}>Case summary sentence</span>
          </div>
          <p className={styles.pipelineStepBody}>
            The client requests a compact constructed sentence from the backend so policy search has a stable
            semantic query anchored in the full report context.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSystem}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSystem}`}>System</span>
            <span className={styles.pipelineStepTitle}>Policy search (RAG)</span>
          </div>
          <p className={styles.pipelineStepBody}>
            Embeddings retrieve the top candidates from an indexed policy corpus (for example 3M Code of Conduct
            chunks in Chroma), apply a similarity floor, then an LLM re-ranker scores each passage (1–5); scores
            below 3 are discarded so weak matches are not forced on reporters.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepReporter}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeReporter}`}>Reporter</span>
            <span className={styles.pipelineStepTitle}>Policy question (fixed wording)</span>
          </div>
          <p className={styles.pipelineStepBody}>
            The excerpt (when available) is shown with the standard prompt:{' '}
            <strong>&ldquo;How well does this policy excerpt describe your experience?&rdquo;</strong> The
            answer is stored with the submission for investigators.
          </p>
        </div>

        <div className={styles.pipelineArrow}>↓</div>

        <div className={`${styles.pipelineStep} ${styles.pipelineStepSubmit}`}>
          <div className={styles.pipelineStepHeader}>
            <span className={`${styles.pipelineBadge} ${styles.pipelineBadgeSubmit}`}>Review</span>
            <span className={styles.pipelineStepTitle}>Editable recap, then submit</span>
          </div>
          <p className={styles.pipelineStepBody}>
            The reporter confirms answers, then the full package (including extraction, gaps, follow-up text,
            policy fields, and summary data available at submit time) is available in the Feed for authorised
            reviewers.
          </p>
        </div>
      </div>

      <p className={styles.p}>
        The pipeline is resilient by design: failures during AI or RAG steps surface recovery options in the
        UI where implemented so a report is not abandoned silently.
      </p>
    </section>
  )
}
