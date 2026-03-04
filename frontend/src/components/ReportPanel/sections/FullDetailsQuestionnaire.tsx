import { useState, useRef, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { FormField } from './FormField'
import styles from './FullDetailsQuestionnaire.module.css'

const Q1_LABEL = 'Please describe what happened in your own words.'

type Step = 'q1' | 'analyzing' | 'fq1' | 'fq2' | 'review'

function stepLabel(step: Step, totalFollowUps: number): string {
  if (step === 'q1') return 'Question 1'
  if (step === 'fq1') return `Question 2 of ${1 + totalFollowUps}`
  if (step === 'fq2') return `Question 3 of ${1 + totalFollowUps}`
  return ''
}

export function FullDetailsQuestionnaire() {
  const { report, updateReport } = useReport()
  const [step, setStep] = useState<Step>('q1')
  const stepRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)

  // Intake analysis is enabled only when we move to 'analyzing' step
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false)
  const { followUpQuestions, isLoading: isAnalyzing, error: analyzeError } =
    useIntakeAnalysis(report.full_details_q1, analyzeEnabled)

  // Derived: which follow-up steps are available
  const fq1 = followUpQuestions[0] ?? null
  const fq2 = followUpQuestions[1] ?? null
  const totalFollowUps = followUpQuestions.length

  // After analysis completes successfully, persist question texts and advance.
  // Do NOT advance when there is an error — let the user see the error UI and
  // choose to go Back or Skip manually.
  useEffect(() => {
    if (step !== 'analyzing' || isAnalyzing || analyzeError) return

    // Persist follow-up question texts for PDF generation
    const updates: Partial<typeof report> = {}
    if (followUpQuestions[0]) updates.full_details_q2_question = followUpQuestions[0].question_text
    if (followUpQuestions[1]) updates.full_details_q3_question = followUpQuestions[1].question_text
    if (Object.keys(updates).length > 0) updateReport(updates)

    // Advance to first follow-up if any, else review
    if (followUpQuestions.length > 0) {
      setStep('fq1')
    } else {
      setStep('review')
    }
  }, [step, isAnalyzing, analyzeError, followUpQuestions])

  // Scroll to top of component on step change
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    stepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const handleQ1Next = () => {
    setAnalyzeEnabled(true)
    setStep('analyzing')
  }

  const handleFq1Next = () => {
    if (fq2) setStep('fq2')
    else setStep('review')
  }

  const handleBack = () => {
    if (step === 'fq1') setStep('q1')
    else if (step === 'fq2') setStep('fq1')
  }

  const handleDone = () => setStep('review')
  const handleRestart = () => {
    setStep('q1')
    setAnalyzeEnabled(false)
  }

  // ── Review mode ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const q1Stored = report.full_details_q2_question
    const q2Stored = report.full_details_q3_question

    const reviewItems: Array<{
      answerKey: keyof typeof report
      question: string
      isQ1?: boolean
    }> = [
      { answerKey: 'full_details_q1', question: Q1_LABEL, isQ1: true },
      ...(fq1 || q1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || q1Stored || '' }]
        : []),
      ...(fq2 || q2Stored
        ? [{ answerKey: 'full_details_q3' as const, question: fq2?.question_text || q2Stored || '' }]
        : []),
    ]

    return (
      <div className={`${styles.block} ${styles.reviewBlock}`}>
        {reviewItems.map((item) => (
          <div key={item.answerKey} className={styles.reviewItem}>
            <div className={item.isQ1 ? styles.reviewQuestionRow : styles.reviewQuestionLabel}>
              {item.question ? (
                <p className={styles.questionText}>{item.question}</p>
              ) : null}
              {item.isQ1 && (
                <button
                  type="button"
                  onClick={handleRestart}
                  className={styles.restartBtn}
                  aria-label="Restart step-by-step questionnaire"
                >
                  <span aria-hidden>↺</span> Restart
                </button>
              )}
            </div>
            <div className={styles.reviewField}>
              <FormField
                label=""
                value={report[item.answerKey] as string}
                onChange={(v) => updateReport({ [item.answerKey]: v })}
                type="textarea"
                rows={4}
                placeholder="Your answer"
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Analyzing step ───────────────────────────────────────────────────────────
  if (step === 'analyzing') {
    return (
      <div ref={stepRef} className={styles.block}>
        <div className={styles.stepContent}>
          {isAnalyzing && (
            <p className={styles.loadingText}>Analyzing your report…</p>
          )}
          {analyzeError && !isAnalyzing && (
            <>
              <p className={styles.errorText} role="alert">
                Could not analyze report: {analyzeError}
              </p>
              <div className={styles.navBar}>
                <div className={styles.navBarLeft}>
                  <button type="button" onClick={() => setStep('q1')} className={styles.navBtn}>
                    <span aria-hidden>←</span> Back
                  </button>
                </div>
                <div className={styles.navBarRight}>
                  <button
                    type="button"
                    onClick={() => setStep('review')}
                    className={styles.navBtn}
                  >
                    Skip &amp; Continue <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Q1 step ─────────────────────────────────────────────────────────────────
  if (step === 'q1') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 1</p>
        <div className={styles.stepContent}>
          <FormField
            label={Q1_LABEL}
            value={report.full_details_q1}
            onChange={(v) => updateReport({ full_details_q1: v })}
            type="textarea"
            rows={8}
            placeholder="Type your answer here…"
          />
        </div>
        <div className={styles.navBar}>
          <div className={styles.navBarLeft} />
          <div className={styles.navBarRight}>
            <button
              type="button"
              onClick={handleQ1Next}
              className={styles.navBtn}
              disabled={!report.full_details_q1?.trim()}
              aria-label="Next question"
            >
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Follow-up step 1 ────────────────────────────────────────────────────────
  if (step === 'fq1' && fq1) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>{stepLabel('fq1', totalFollowUps)}</p>
        <div className={styles.stepContent}>
          <p className={styles.questionText}>{fq1.question_text}</p>
          <FormField
            label=""
            value={report.full_details_q2}
            onChange={(v) => updateReport({ full_details_q2: v })}
            type="textarea"
            rows={8}
            placeholder="Type your answer here…"
          />
        </div>
        <div className={styles.navBar}>
          <div className={styles.navBarLeft}>
            <button type="button" onClick={handleBack} className={styles.navBtn} aria-label="Previous question">
              <span aria-hidden>←</span> Back
            </button>
          </div>
          <div className={styles.navBarRight}>
            {fq2 ? (
              <button type="button" onClick={handleFq1Next} className={styles.navBtn} aria-label="Next question">
                Next <span aria-hidden>→</span>
              </button>
            ) : (
              <button type="button" onClick={handleDone} className={styles.navBtn} aria-label="Finish and review">
                Done <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Follow-up step 2 ────────────────────────────────────────────────────────
  if (step === 'fq2' && fq2) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>{stepLabel('fq2', totalFollowUps)}</p>
        <div className={styles.stepContent}>
          <p className={styles.questionText}>{fq2.question_text}</p>
          <FormField
            label=""
            value={report.full_details_q3}
            onChange={(v) => updateReport({ full_details_q3: v })}
            type="textarea"
            rows={8}
            placeholder="Type your answer here…"
          />
        </div>
        <div className={styles.navBar}>
          <div className={styles.navBarLeft}>
            <button type="button" onClick={handleBack} className={styles.navBtn} aria-label="Previous question">
              <span aria-hidden>←</span> Back
            </button>
          </div>
          <div className={styles.navBarRight}>
            <button type="button" onClick={handleDone} className={styles.navBtn} aria-label="Finish and review">
              Done <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Fallback: should not normally reach here
  return null
}
