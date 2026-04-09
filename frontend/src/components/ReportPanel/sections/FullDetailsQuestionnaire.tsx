import { useState, useRef, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { useConstructedSentence } from '@/hooks/useConstructedSentence'
import { usePolicyQuote } from '@/hooks/usePolicyQuote'
import { FormField } from './FormField'
import type { Layer1Extraction } from '@/utils/feedStore'
import styles from './FullDetailsQuestionnaire.module.css'

const Q1_LABEL = 'Please describe what happened in your own words.'
const Q3_QUESTION = 'Do you believe this policy has been violated? If Yes, to what extent?'

type Step = 'q1' | 'analyzing' | 'fq1' | 'constructing' | 'policyLoading' | 'policyQuestion' | 'review'

export function FullDetailsQuestionnaire() {
  const { report, updateReport, setPipelineStatus, setIntakeAnalysisResult } = useReport()
  const [step, setStep] = useState<Step>('q1')
  const stepRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef<Step>(step)
  const fq1WasShownRef = useRef(false)

  // Intake analysis is enabled only when we move to 'analyzing' step
  const [analyzeEnabled, setAnalyzeEnabled] = useState(false)
  const { followUpQuestions, analysisResult, isLoading: isAnalyzing, hasAnalyzed, error: analyzeError, reset: resetIntake } =
    useIntakeAnalysis(report.full_details_q1, analyzeEnabled, report as unknown as Record<string, string>)

  // Constructed sentence is enabled only when we move to 'constructing' step
  const [constructEnabled, setConstructEnabled] = useState(false)
  const { sentence: constructedSentence, isLoading: isConstructing, error: constructError, reset: resetConstruct } =
    useConstructedSentence(report, constructEnabled)

  // Policy quote is enabled only when we move to 'policyLoading' step
  const [policyEnabled, setPolicyEnabled] = useState(false)
  const { quote: policyQuote, section: policySection, isLoading: isPolicyLoading, error: policyError, reset: resetPolicy } =
    usePolicyQuote(report, policyEnabled, constructedSentence)

  // Derived: only the first follow-up is used
  const fq1 = followUpQuestions[0] ?? null

  // After analysis completes successfully, persist question text and advance.
  useEffect(() => {
    if (step !== 'analyzing' || isAnalyzing) return

    if (analyzeError) {
      setPipelineStatus('error')
      return
    }

    if (!hasAnalyzed) return

    // Store the full analysis result in context for use at submit time
    if (analysisResult) {
      setIntakeAnalysisResult({
        extraction: analysisResult.extraction as Layer1Extraction | null,
        gaps: analysisResult.gaps,
        follow_up_questions: analysisResult.follow_up_questions,
      })
    }

    // Persist first follow-up question text for PDF generation
    if (followUpQuestions[0]) {
      updateReport({ full_details_q2_question: followUpQuestions[0].question_text })
    }

    // Advance to follow-up if any, else construct sentence and load policy
    if (followUpQuestions.length > 0) {
      fq1WasShownRef.current = true
      setStep('fq1')
    } else {
      setPipelineStatus('constructing')
      setConstructEnabled(true)
      setStep('constructing')
    }
  }, [step, isAnalyzing, analyzeError, hasAnalyzed, followUpQuestions])

  // After constructed sentence completes, persist and advance to policy loading
  useEffect(() => {
    if (step !== 'constructing' || isConstructing) return

    if (constructError) {
      setPipelineStatus('error')
      return
    }

    if (constructedSentence) {
      updateReport({ constructed_sentence: constructedSentence })
    }

    setPipelineStatus('policyLoading')
    setPolicyEnabled(true)
    setStep('policyLoading')
  }, [step, isConstructing, constructedSentence, constructError])

  // After policy quote loading completes, persist and advance
  useEffect(() => {
    if (step !== 'policyLoading' || isPolicyLoading) return

    // "policy_unavailable" means no relevant policy was found — this is expected
    // and handled gracefully in policyQuestion with a fallback message.
    // Only treat other errors as pipeline failures.
    if (policyError && policyError !== 'policy_unavailable') {
      setPipelineStatus('error')
      return
    }

    // Always persist Q3 question text; persist quote + section only if available
    updateReport({
      full_details_q3_question: Q3_QUESTION,
      ...(policyQuote ? { policy_quote_matched: policyQuote } : {}),
      ...(policySection ? { policy_section_matched: policySection } : {}),
    })

    setStep('policyQuestion')
  }, [step, isPolicyLoading, policyQuote, policySection, policyError])

  // Scroll to top of component on step change (but not on initial mount)
  useEffect(() => {
    if (prevStepRef.current === step) return
    prevStepRef.current = step
    stepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const handleQ1Next = () => {
    setPipelineStatus('analyzing')
    setAnalyzeEnabled(true)
    setStep('analyzing')
  }

  const handleBack = () => {
    if (step === 'fq1') setStep('q1')
    if (step === 'policyQuestion') setStep(fq1WasShownRef.current ? 'fq1' : 'q1')
  }

  const handleFq1Done = () => {
    setPipelineStatus('constructing')
    setConstructEnabled(true)
    setStep('constructing')
  }

  const handleDone = () => {
    setPipelineStatus('ready')
    setStep('review')
  }
  const handleRestart = () => {
    setPipelineStatus('idle')
    setStep('q1')
    setAnalyzeEnabled(false)
    setConstructEnabled(false)
    setPolicyEnabled(false)
    resetIntake()
    resetConstruct()
    resetPolicy()
    fq1WasShownRef.current = false
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
      policySection?: string
    }> = [
      { answerKey: 'full_details_q1', question: Q1_LABEL, isQ1: true },
      ...(fq1 || fq1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || fq1Stored || '' }]
        : []),
      ...((q3Stored || report.full_details_q3)
        ? [{
            answerKey: 'full_details_q3' as const,
            question: q3Stored || Q3_QUESTION,
            policyQuote: report.policy_quote_matched || policyQuote || undefined,
            policySection: report.policy_section_matched || policySection || undefined,
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
                {item.policySection && (
                  <cite className={styles.policyCite}>— {item.policySection}</cite>
                )}
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
                      setPipelineStatus('constructing')
                      setConstructEnabled(true)
                      setStep('constructing')
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

  // ── Constructing sentence step ──────────────────────────────────────────────
  if (step === 'constructing') {
    return (
      <div ref={stepRef} className={styles.block}>
        <div className={styles.stepContent}>
          {isConstructing && (
            <p className={styles.loadingText}>Building case summary…</p>
          )}
          {constructError && !isConstructing && (
            <>
              <p className={styles.errorText} role="alert">
                Could not build case summary: {constructError}
              </p>
              <div className={styles.navBar}>
                <div className={styles.navBarLeft}>
                  <button type="button" onClick={() => setStep(fq1WasShownRef.current ? 'fq1' : 'q1')} className={styles.navBtn}>
                    <span aria-hidden>←</span> Back
                  </button>
                </div>
                <div className={styles.navBarRight}>
                  <button
                    type="button"
                    onClick={() => {
                      setPipelineStatus('policyLoading')
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
          {isPolicyLoading && (
            <p className={styles.loadingText}>Finding relevant policy…</p>
          )}
          {policyError && policyError !== 'policy_unavailable' && !isPolicyLoading && (
            <>
              <p className={styles.errorText} role="alert">
                Could not find relevant policy: {policyError}
              </p>
              <div className={styles.navBar}>
                <div className={styles.navBarLeft}>
                  <button type="button" onClick={() => setStep(fq1WasShownRef.current ? 'fq1' : 'q1')} className={styles.navBtn}>
                    <span aria-hidden>←</span> Back
                  </button>
                </div>
                <div className={styles.navBarRight}>
                  <button
                    type="button"
                    onClick={() => {
                      setPipelineStatus('ready')
                      setStep('policyQuestion')
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
          <p className={styles.encouragement}>
            Remember, you are doing the right thing. Submitting this report helps create a safer, fairer workplace for everyone.
          </p>
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
            <button type="button" onClick={handleFq1Done} className={styles.navBtn} disabled={!report.full_details_q2?.trim()} aria-label="Next question">
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
              No specific policy section was identified for your report. You can still share your perspective on how you believe organisational policies apply to this situation.
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
