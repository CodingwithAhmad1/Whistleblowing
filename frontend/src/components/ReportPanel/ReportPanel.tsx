import { useState } from 'react'
import { AntiRetaliationBanner } from './AntiRetaliationBanner'
import { OrganizationContext } from './sections/OrganizationContext'
import { ReporterPreferences } from './sections/ReporterPreferences'
import { ManagementAwareness } from './sections/ManagementAwareness'
import { Incident } from './sections/Incident'
import { FormSection } from './FormSection'
import { useReport } from '@/context/ReportContext'
import { saveSubmission } from '@/utils/feedStore'
import { API_CONFIG } from '@/config'
import { buildAnalysisText } from '@/utils/buildAnalysisText'
import styles from './ReportPanel.module.css'

const PIPELINE_LABELS: Record<string, string> = {
  analyzing: 'Analyzing your report\u2026',
  constructing: 'Building case summary\u2026',
  policyLoading: 'Finding relevant policy\u2026',
}

export function ReportPanel() {
  const { report, pipelineStatus, intakeAnalysisResult, resetAIFullDetailsWorkflow } = useReport()
  const [toastPhase, setToastPhase] = useState<'hidden' | 'visible' | 'fading'>('hidden')

  const isProcessing = pipelineStatus === 'analyzing' || pipelineStatus === 'constructing' || pipelineStatus === 'policyLoading'
  const hasError = pipelineStatus === 'error'
  const canSubmit = !isProcessing && !hasError

  const handleSubmit = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let snapshot: any = intakeAnalysisResult

    if (!snapshot) {
      // Questionnaire was skipped — run analysis on-demand using available form data
      try {
        const res = await fetch(API_CONFIG.ENDPOINTS.INTAKE_ANALYZE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q1_text: buildAnalysisText(report),
            form_data: report as unknown as Record<string, string>,
          }),
        })
        if (res.ok) {
          snapshot = await res.json()
        }
      } catch (e) {
        console.error('[Submit] On-demand analysis failed:', e)
      }
    }

    // Dual-corpus coverage snapshot (Component C's input). Best-effort: a
    // failed classification never blocks the submission itself.
    let coverage = null
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RAG_COVERAGE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_data: report,
          ...(report.constructed_sentence ? { constructed_sentence: report.constructed_sentence } : {}),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        coverage = data?.coverage ?? null
      }
    } catch (e) {
      console.error('[Submit] Coverage classification failed:', e)
    }

    await saveSubmission({
      timestamp: new Date().toISOString(),
      formData: report,
      extraction: snapshot?.extraction ?? null,
      extractionBreakdown: snapshot?.extraction_breakdown ?? null,
      gaps: snapshot?.gaps ?? [],
      followUpQuestions: snapshot?.follow_up_questions ?? [],
      coverage,
    })
    setToastPhase('visible')
    setTimeout(() => setToastPhase('fading'), 2700)
    setTimeout(() => setToastPhase('hidden'), 3000)
  }

  return (
    <>
    {toastPhase !== 'hidden' && (
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 20px',
        borderRadius: '10px',
        background: '#f0fdf4',
        border: '1px solid #86efac',
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        fontSize: '14px',
        color: '#166534',
        fontFamily: 'system-ui, sans-serif',
        transition: 'opacity 0.3s ease',
        opacity: toastPhase === 'fading' ? 0 : 1,
      }}>
        <span style={{ fontSize: '16px' }}>&#10003;</span>
        <span>Report submitted successfully</span>
      </div>
    )}
    <div className={styles.panel}>
      <div className={styles.scrollArea}>
        <div className={styles.formContent}>
          <header className={styles.header}>
            <h1 className={styles.title}>Whistleblower Report</h1>
          </header>
          <AntiRetaliationBanner />
          <FormSection
            title="Organization & Context"
            subtitle="Basic information about your organization and where the incident took place."
          >
            <OrganizationContext />
          </FormSection>

          <FormSection
            title="Reporter Preferences"
            subtitle="How you would like to be identified in this report."
          >
            <ReporterPreferences />
          </FormSection>

          <FormSection
            title="Identifying Persons and Management"
            subtitle="Who is involved and whether management is aware."
          >
            <ManagementAwareness />
          </FormSection>

          <FormSection title="Incident Details">
            <Incident />
          </FormSection>

          <div className={styles.submitArea}>
            {isProcessing && (
              <p className={styles.statusText}>{PIPELINE_LABELS[pipelineStatus]}</p>
            )}
            {hasError && (
              <div className={styles.errorRow}>
                <p className={styles.statusError}>
                  A pipeline step encountered an error. Please resolve or skip it in the questionnaire above.
                </p>
                <button
                  type="button"
                  onClick={resetAIFullDetailsWorkflow}
                  className={styles.resetWorkflowBtn}
                >
                  Reset AI workflow
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className={styles.submitButton}
              disabled={!canSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
