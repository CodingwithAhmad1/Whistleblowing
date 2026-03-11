import { useState, useRef, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { usePolicyQuote } from '@/hooks/usePolicyQuote'
import { FormField } from './FormField'
import styles from './FullDetailsQuestionnaire.module.css'

const Q1_LABEL = 'Please describe what happened in your own words.'
const Q3_QUESTION = 'How closely does this policy match your incident?'

type Step = 'q1' | 'analyzing' | 'fq1' | 'policyLoading' | 'policyQuestion' | 'review'

export function FullDetailsQuestionnaire() {
  const { report, updateReport } = useReport()
  const [step, setStep] = useState<Step>('q1')
  const stepRef = useRef<HTMLDivElement>(null)
  const hasMounted = useRef(false)

  // Intake analysis is enabled only when we move to 'analyzing' step
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false)
  const { followUpQuestions, isLoading: isAnalyzing, hasAnalyzed, error: analyzeError } =
    useIntakeAnalysis(report.full_details_q1, analyzeEnabled)

  // Policy quote is enabled only when we move to 'policyLoading' step
  const [policyEnabled, setPolicyEnabled] = useState(false)
  const { quote: policyQuote, section: policySection, isLoading: isPolicyLoading, error: policyError } =
    usePolicyQuote(report, policyEnabled)

  // Derived: only the first follow-up is used
  const fq1 = followUpQuestions[0] ?? null

  // After analysis completes successfully, persist question text and advance.
  useEffect(() => {
    if (step !== 'analyzing' || isAnalyzing || analyzeError || !hasAnalyzed) return

    // Persist first follow-up question text for PDF generation
    if (followUpQuestions[0]) {
      updateReport({ full_details_q2_question: followUpQuestions[0].question_text })
    }

    // Advance to follow-up if any, else policy loading
    if (followUpQuestions.length > 0) {
      setStep('fq1')
    } else {
      setPolicyEnabled(true)
      setStep('policyLoading')
    }
  }, [step, isAnalyzing, analyzeError, hasAnalyzed, followUpQuestions])

  // After policy quote loading completes, persist and advance
  useEffect(() => {
    if (step !== 'policyLoading' || isPolicyLoading) return

    // Persist the quote and question text
    if (policyQuote) {
      updateReport({
        policy_quote_matched: policyQuote,
        full_details_q3_question: Q3_QUESTION,
      })
    }

    setStep('policyQuestion')
  }, [step, isPolicyLoading, policyQuote])

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
    if (step === 'policyQuestion') setStep('fq1')
  }

  const handleFq1Done = () => {
    setPolicyEnabled(true)
    setStep('policyLoading')
  }

  const handleDone = () => setStep('review')
  const handleRestart = () => {
    setStep('q1')
    setAnalyzeEnabled(false)
    setPolicyEnabled(false)
  }

  // ── Review mode ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const fq1Stored = report.full_details_q2_question
    const q3Stored = report.full_details_q3_question

    const reviewItems: Array<{
      answerKey: keyof typeof report
      question: string
      isQ1?: boolean
      policyQuote?: string
    }> = [
      { answerKey: 'full_details_q1', question: Q1_LABEL, isQ1: true },
      ...(fq1 || fq1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || fq1Stored || '' }]
        : []),
      ...((q3Stored || report.full_details_q3)
        ? [{
            answerKey: 'full_details_q3' as const,
            question: q3Stored || Q3_QUESTION,
            policyQuote: report.policy_quote_matched || undefined,
          }]
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
            {item.policyQuote && (
              <blockquote className={styles.policyCallout}>
                {item.policyQuote}
              </blockquote>
            )}
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
                    onClick={() => {
                      setPolicyEnabled(true)
                      setStep('policyLoading')
                    }}
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

  // ── Policy loading step ──────────────────────────────────────────────────────
  if (step === 'policyLoading') {
    return (
      <div ref={stepRef} className={styles.block}>
        <div className={styles.stepContent}>
          <p className={styles.loadingText}>Finding relevant policy…</p>
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
            <button type="button" onClick={handleFq1Done} className={styles.navBtn} aria-label="Next question">
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Policy question step (Q3) ───────────────────────────────────────────────
  if (step === 'policyQuestion') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 3</p>
        <div className={styles.stepContent}>
          {policyQuote ? (
            <blockquote className={styles.policyCallout}>
              {policyQuote}
              {policySection && (
                <cite className={styles.policyCite}>— {policySection}</cite>
              )}
            </blockquote>
          ) : (
            <p className={styles.fillerText}>
              We weren't able to retrieve a relevant policy section. You can still describe how organizational policies relate to your incident.
            </p>
          )}
          <p className={styles.questionText}>{Q3_QUESTION}</p>
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
