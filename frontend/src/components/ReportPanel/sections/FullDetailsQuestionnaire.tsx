import { useState, useRef, useEffect, useMemo } from 'react'
import { useReport } from '@/context/ReportContext'
import { useIntakeAnalysis } from '@/hooks/useIntakeAnalysis'
import { useConstructedSentence } from '@/hooks/useConstructedSentence'
import { usePolicyQuote } from '@/hooks/usePolicyQuote'
import { FormField } from './FormField'
import type { Layer1Extraction } from '@/utils/feedStore'
import { EVIDENCE_DESCRIPTION_LABEL } from '@/data/incidentIntakeCopy'
import { buildAnalysisText } from '@/utils/buildAnalysisText'
import { FULL_DETAILS_Q3_QUESTION } from '@/constants/policyQuestion'
import styles from './FullDetailsQuestionnaire.module.css'

type Step =
  | 'idle'
  | 'analyzing'
  | 'fq1'
  | 'fq2'
  | 'constructing'
  | 'policyLoading'
  | 'policyQuestion'
  | 'review'

export function FullDetailsQuestionnaire() {
  const { report, updateReport, setPipelineStatus, setIntakeAnalysisResult } = useReport()
  const [step, setStep] = useState<Step>('idle')
  const stepRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef<Step>(step)
  const fq1WasShownRef = useRef(false)
  const fq2WasShownRef = useRef(false)

  const intakeQ1Text = useMemo(() => buildAnalysisText(report), [report])

  const [analyzeEnabled, setAnalyzeEnabled] = useState(false)
  const [intakeRunId, setIntakeRunId] = useState(0)
  const [intakeFallbackNotice, setIntakeFallbackNotice] = useState(false)
  const { followUpQuestions, analysisResult, isLoading: isAnalyzing, hasAnalyzed, error: analyzeError, reset: resetIntake } =
    useIntakeAnalysis(intakeQ1Text, analyzeEnabled, report as unknown as Record<string, string>, intakeRunId)

  const [constructEnabled, setConstructEnabled] = useState(false)
  const { sentence: constructedSentence, isLoading: isConstructing, error: constructError, reset: resetConstruct } =
    useConstructedSentence(report, constructEnabled)

  const [policyEnabled, setPolicyEnabled] = useState(false)
  const { quote: policyQuote, section: policySection, isLoading: isPolicyLoading, error: policyError, reset: resetPolicy } =
    usePolicyQuote(report, policyEnabled, constructedSentence)

  const fq1 = followUpQuestions[0] ?? null
  const fq2 = followUpQuestions[1] ?? null

  useEffect(() => {
    if (step !== 'analyzing' || isAnalyzing) return

    if (analyzeError) {
      setPipelineStatus('error')
      return
    }

    if (!hasAnalyzed) return

    if (analysisResult) {
      setIntakeAnalysisResult({
        extraction: analysisResult.extraction as Layer1Extraction | null,
        extraction_breakdown: analysisResult.extraction_breakdown ?? null,
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

    setIntakeFallbackNotice(
      Boolean(analysisResult?.used_defaults) || analysisResult?.analysis_available === false,
    )

    if (followUpQuestions.length > 0) {
      fq1WasShownRef.current = true
      setStep('fq1')
    } else {
      setPipelineStatus('constructing')
      setConstructEnabled(true)
      setStep('constructing')
    }

    setAnalyzeEnabled(false)
  }, [step, isAnalyzing, analyzeError, hasAnalyzed, followUpQuestions, analysisResult, setIntakeAnalysisResult, setPipelineStatus, updateReport])

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
    setIntakeFallbackNotice(false)
  }, [step, isConstructing, constructedSentence, constructError, setPipelineStatus, updateReport])

  useEffect(() => {
    if (step !== 'policyLoading' || isPolicyLoading) return

    if (policyError && policyError !== 'policy_unavailable') {
      setPipelineStatus('error')
      return
    }

    updateReport({
      full_details_q3_question: FULL_DETAILS_Q3_QUESTION,
      ...(policyQuote ? { policy_quote_matched: policyQuote } : {}),
      ...(policySection ? { policy_section_matched: policySection } : {}),
    })

    setStep('policyQuestion')
  }, [step, isPolicyLoading, policyQuote, policySection, policyError, setPipelineStatus, updateReport])

  useEffect(() => {
    if (prevStepRef.current === step) return
    prevStepRef.current = step
    stepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const goBackToIdle = () => {
    setStep('idle')
    setAnalyzeEnabled(false)
    setPipelineStatus('idle')
  }

  const handleStartAi = () => {
    setIntakeFallbackNotice(false)
    setIntakeRunId((n) => n + 1)
    setPipelineStatus('analyzing')
    setAnalyzeEnabled(true)
    setStep('analyzing')
  }

  const handleBack = () => {
    if (step === 'fq1') {
      setIntakeFallbackNotice(false)
      goBackToIdle()
      resetIntake()
    }
    if (step === 'fq2') setStep('fq1')
    if (step === 'policyQuestion') {
      if (fq2WasShownRef.current) setStep('fq2')
      else if (fq1WasShownRef.current) setStep('fq1')
      else {
        goBackToIdle()
        resetIntake()
      }
    }
  }

  const handleFq1Done = () => {
    setIntakeFallbackNotice(false)
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
    setIntakeFallbackNotice(false)
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
    setStep('idle')
    setAnalyzeEnabled(false)
    setIntakeFallbackNotice(false)
    setConstructEnabled(false)
    setPolicyEnabled(false)
    resetIntake()
    resetConstruct()
    resetPolicy()
    fq1WasShownRef.current = false
    fq2WasShownRef.current = false
  }

  const policyStepNumber = fq2WasShownRef.current ? 3 : fq1WasShownRef.current ? 2 : 1

  // ── Review mode ─────────────────────────────────────────────────────────────
  if (step === 'review') {
    const fq1Stored = report.full_details_q2_question
    const fq2Stored = report.full_details_gap2_question
    const q3Stored = report.full_details_q3_question

    let reviewItems: Array<{
      answerKey: keyof typeof report
      question: string
      isRestartAnchor?: boolean
      policyQuote?: string
      policySection?: string
    }> = [
      ...(report.has_supporting_materials !== 'no'
        ? [{ answerKey: 'evidence_description' as const, question: EVIDENCE_DESCRIPTION_LABEL, isRestartAnchor: true }]
        : []),
      ...(fq1 || fq1Stored
        ? [{ answerKey: 'full_details_q2' as const, question: fq1?.question_text || fq1Stored || '' }]
        : []),
      ...(fq2 || fq2Stored
        ? [{ answerKey: 'full_details_gap2' as const, question: fq2?.question_text || fq2Stored || '' }]
        : []),
      ...((q3Stored || report.full_details_q3)
        ? [{
            answerKey: 'full_details_q3' as const,
            question: q3Stored || FULL_DETAILS_Q3_QUESTION,
            policyQuote: report.policy_quote_matched || policyQuote || undefined,
            policySection: report.policy_section_matched || policySection || undefined,
          }]
        : []),
    ]

    if (reviewItems.length > 0 && !reviewItems.some((i) => i.isRestartAnchor)) {
      reviewItems = reviewItems.map((item, idx) =>
        idx === 0 ? { ...item, isRestartAnchor: true } : item,
      )
    }

    return (
      <div className={`${styles.block} ${styles.reviewBlock}`}>
        {reviewItems.map((item) => (
          <div key={String(item.answerKey)} className={styles.reviewItem}>
            <div className={item.isRestartAnchor ? styles.reviewQuestionRow : styles.reviewQuestionLabel}>
              {item.question ? (
                <p className={styles.questionText}>{item.question}</p>
              ) : null}
              {item.isRestartAnchor && (
                <button
                  type="button"
                  onClick={handleRestart}
                  className={styles.restartBtn}
                  aria-label="Restart AI follow-up questionnaire"
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
                  <button
                    type="button"
                    onClick={() => {
                      goBackToIdle()
                      resetIntake()
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

  if (step === 'constructing') {
    return (
      <div ref={stepRef} className={styles.block}>
        <div className={styles.stepContent}>
          {intakeFallbackNotice && (
            <p className={styles.intakeFallbackNotice} role="status">
              We couldn&apos;t extract every detail from your narrative automatically; no additional questions were
              suggested. You can continue as usual.
            </p>
          )}
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
                      else {
                        goBackToIdle()
                        resetIntake()
                      }
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
                      else {
                        goBackToIdle()
                        resetIntake()
                      }
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

  if (step === 'fq1' && fq1) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 1</p>
        <div className={styles.stepContent}>
          {intakeFallbackNotice && (
            <p className={styles.intakeFallbackNotice} role="status">
              We couldn&apos;t extract every detail from your narrative automatically; you can continue as usual.
            </p>
          )}
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
            <button type="button" onClick={handleBack} className={styles.navBtn} aria-label="Previous step">
              <span aria-hidden>←</span> Back
            </button>
          </div>
          <div className={styles.navBarRight}>
            <button
              type="button"
              onClick={handleFq1Done}
              className={styles.navBtn}
              disabled={!report.full_details_q2?.trim()}
              aria-label="Next question"
            >
              Next <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'fq2' && fq2) {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question 2</p>
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

  if (step === 'policyQuestion') {
    return (
      <div ref={stepRef} className={styles.block}>
        <p className={styles.stepIndicator}>Question {policyStepNumber}</p>
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
          <p className={styles.questionText}>{FULL_DETAILS_Q3_QUESTION}</p>
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
            <button type="button" onClick={handleBack} className={styles.navBtn} aria-label="Previous step">
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

  // idle (default) — manual trigger for AI follow-up
  return (
    <div ref={stepRef} className={styles.block}>
      <p className={styles.idleHeading}>AI follow-up</p>
      <div className={styles.idleContent}>
        <p className={styles.idleIntro}>
          When you are ready, we can suggest additional questions based on your report.
        </p>
        <div className={styles.idleActions}>
          <button
            type="button"
            onClick={handleStartAi}
            className={styles.navBtn}
            aria-label="Generate AI follow-up"
          >
            Generate AI follow-up
          </button>
        </div>
      </div>
    </div>
  )
}
