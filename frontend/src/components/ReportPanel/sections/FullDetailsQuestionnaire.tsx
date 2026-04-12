import { useState, useRef, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { useConstructedSentence } from '@/hooks/useConstructedSentence'
import { usePolicyQuote } from '@/hooks/usePolicyQuote'
import { FormField } from './FormField'
import type { Layer1Extraction } from '@/utils/feedStore'
import styles from './FullDetailsQuestionnaire.module.css'

const Q1_LABEL = 'Please describe what happened in your own words.'
const SEQUENCE_LABEL = 'To help us understand the sequence of events, could you describe what happened first and what happened next?'
const EVIDENCE_LABEL = 'Do you have any supporting materials related to this — documents, emails, screenshots, photos, or other evidence? If so, please describe them. If not, write "None".'
const Q3_QUESTION = 'Do you believe this policy has been violated? If Yes, to what extent?'

type Step =
  | 'q1'
  | 'q_sequence'
  | 'q_evidence'
  | 'analyzing'
  | 'fq1'
  | 'fq2'
  | 'constructing'
  | 'policyLoading'
  | 'policyQuestion'
  | 'review'

export function FullDetailsQuestionnaire() {
  const { report, updateReport, setPipelineStatus, setIntakeAnalysisResult } = useReport()
  const [step, setStep] = useState<Step>('q1')
  const stepRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef<Step>(step)
  const fq1WasShownRef = useRef(false)
  const fq2WasShownRef = useRef(false)

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

  const fq1 = followUpQuestions[0] ?? null
  const fq2 = followUpQuestions[1] ?? null

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

    if (followUpQuestions[0]) {
      updateReport({ full_details_q2_question: followUpQuestions[0].question_text })
    }
    if (followUpQuestions[1]) {
      updateReport({ full_details_gap2_question: followUpQuestions[1].question_text })
    }

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
    setStep('q_sequence')
  }

  const handleSequenceNext = () => {
    setStep('q_evidence')
  }

  const handleEvidenceNext = () => {
    setPipelineStatus('analyzing')
    setAnalyzeEnabled(true)
    setStep('analyzing')
  }

  const handleBack = () => {
    if (step === 'q_sequence') setStep('q1')
    if (step === 'q_evidence') setStep('q_sequence')
    if (step === 'fq1') setStep('q_evidence')
    if (step === 'fq2') setStep('fq1')
    if (step === 'policyQuestion') {
      if (fq2WasShownRef.current) setStep('fq2')
      else if (fq1WasShownRef.current) setStep('fq1')
      else setStep('q_evidence')
    }
  }

  const handleFq1Done = () => {
    if (fq2) {
      fq2WasShownRef.current = true
      setStep('fq2')
      return
    }
    setPipelineStatus('constructing')
    setConstructEnabled(true)
    setStep('constructing')
  }

  const handleFq2Done = () => {
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
    fq2WasShownRef.current = false
  }

  // ── Review mode ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const fq1Stored = report.full_details_q2_question
    const fq2Stored = report.full_details_gap2_question
    const q3Stored = report.full_details_q3_question

    const reviewItems: Array<{
      answerKey: keyof typeof report
      question: string
      isQ1?: boolean
      policyQuote?: string
      policySection?: string
    }> = [
      { answerKey: 'full_details_q1', question: Q1_LABEL, isQ1: true },
      { answerKey: 'sequence_of_events', question: SEQUENCE_LABEL },
      { answerKey: 'evidence_description', question: EVIDENCE_LABEL },
      ...(fq1 || fq1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || fq1Stored || '' }]
        : []),
      ...(fq2 || fq2Stored
        ? [{ answerKey: 'full_details_gap2' as const, question: fq2?.question_text || fq2Stored || '' }]
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
                  <button type="button" onClick={() => setStep('q_evidence')} className={styles.navBtn}>
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
                  <button
                    type="button"
                    onClick={() => {
                      if (fq2WasShownRef.current) setStep('fq2')
                      else if (fq1WasShownRef.current) setStep('fq1')
                      else setStep('q_evidence')
                    }}
                    className={styles.navBtn}
                  >
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
                  <button
                    type="button"
                    onClick={() => {
                      if (fq2WasShownRef.current) setStep('fq2')
                      else if (fq1WasShownRef.current) setStep('fq1')
                      else setStep('q_evidence')
                    }}
                    className={styles.navBtn}
                  >
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

  // ── Sequence of events step (Q2) ────────────────────────────────────────────
  if (step === 'q_sequence') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 2</p>
        <div className={styles.stepContent}>
          <FormField
            label={SEQUENCE_LABEL}
            value={report.sequence_of_events}
            onChange={(v) => updateReport({ sequence_of_events: v })}
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
            <button
              type="button"
              onClick={handleSequenceNext}
              className={styles.navBtn}
              disabled={!report.sequence_of_events?.trim()}
              aria-label="Next question"
            >
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Evidence step (Q3) ──────────────────────────────────────────────────────
  if (step === 'q_evidence') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 3</p>
        <div className={styles.stepContent}>
          <FormField
            label={EVIDENCE_LABEL}
            value={report.evidence_description}
            onChange={(v) => updateReport({ evidence_description: v })}
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
            <button
              type="button"
              onClick={handleEvidenceNext}
              className={styles.navBtn}
              disabled={!report.evidence_description?.trim()}
              aria-label="Next question"
            >
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── AI follow-up step (Q4: AI-generated question) ───────────────────────────
  if (step === 'fq1' && fq1) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 4</p>
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

  // ── Second AI follow-up (optional) ──────────────────────────────────────────
  if (step === 'fq2' && fq2) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 5</p>
        <div className={styles.stepContent}>
          <p className={styles.questionText}>{fq2.question_text}</p>
          <FormField
            label=""
            value={report.full_details_gap2}
            onChange={(v) => updateReport({ full_details_gap2: v })}
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
            <button
              type="button"
              onClick={handleFq2Done}
              className={styles.navBtn}
              disabled={!report.full_details_gap2?.trim()}
              aria-label="Next question"
            >
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Policy question step ─────────────────────────────────────────────────────
  if (step === 'policyQuestion') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>{fq2WasShownRef.current ? 'Question 6' : 'Question 5'}</p>
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
