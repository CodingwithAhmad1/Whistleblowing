import { useState, useRef, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { FormField } from './FormField'
import styles from './FullDetailsQuestionnaire.module.css'

const Q1_LABEL = 'Please describe what happened in your own words.'

type Step = 'q1' | 'analyzing' | 'fq1' | 'review'

export function FullDetailsQuestionnaire() {
  const { report, updateReport } = useReport()
  const [step, setStep] = useState<Step>('q1')
  const stepRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)

  // Intake analysis is enabled only when we move to 'analyzing' step
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false)
  const { followUpQuestions, isLoading: isAnalyzing, error: analyzeError } =
    useIntakeAnalysis(report.full_details_q1, analyzeEnabled)

  // Derived: only the first follow-up is used (Q3 disabled for now)
  const fq1 = followUpQuestions[0] ?? null

  // After analysis completes successfully, persist question text and advance.
  // Do NOT advance when there is an error — let the user see the error UI and
  // choose to go Back or Skip manually.
  useEffect(() => {
    if (step !== 'analyzing' || isAnalyzing || analyzeError) return

    // Persist first follow-up question text for PDF generation
    if (followUpQuestions[0]) {
      updateReport({ full_details_q2_question: followUpQuestions[0].question_text })
    }

    // Advance to follow-up if any, else review
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

  const handleBack = () => {
    if (step === 'fq1') setStep('q1')
  }

  const handleDone = () => setStep('review')
  const handleRestart = () => {
    setStep('q1')
    setAnalyzeEnabled(false)
  }

  // ── Review mode ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const fq1Stored = report.full_details_q2_question

    const reviewItems: Array<{
      answerKey: keyof typeof report
      question: string
      isQ1?: boolean
    }> = [
      { answerKey: 'full_details_q1', question: Q1_LABEL, isQ1: true },
      ...(fq1 || fq1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || fq1Stored || '' }]
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

  // ── Follow-up step (Q2: AI-generated question) ──────────────────────────────
  if (step === 'fq1' && fq1) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 2</p>
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
