import { useState } from 'react'
import { AntiRetaliationBanner } from './AntiRetaliationBanner'
import { OrganizationContext } from './sections/OrganizationContext'
import { ReporterPreferences } from './sections/ReporterPreferences'
import { ManagementAwareness } from './sections/ManagementAwareness'
import { Incident } from './sections/Incident'
import { FormSection } from './FormSection'
import { useReport } from '@/context/ReportContext'
import { generateReportPdf } from '@/utils/generateReportPdf'
import { saveSubmission } from '@/utils/feedStore'
import { API_CONFIG } from '@/config'
import type { ReportData } from '@/types/report'
import styles from './ReportPanel.module.css'

function buildAnalysisText(report: ReportData): string {
  if (report.full_details_q1?.trim()) return report.full_details_q1.trim()
  const parts = [
    report.general_nature && `Nature of incident: ${report.general_nature}`,
    report.where_occurred && `Location: ${report.where_occurred}`,
    report.when_occurred && `When: ${report.when_occurred}`,
    report.how_aware && `How became aware: ${report.how_aware}`,
  ].filter(Boolean)
  return parts.join('. ') || 'No incident details provided.'
}

const PIPELINE_LABELS: Record<string, string> = {
  analyzing: 'Analyzing your report\u2026',
  constructing: 'Building case summary\u2026',
  policyLoading: 'Finding relevant policy\u2026',
}

export function ReportPanel() {
  const { report, pipelineStatus, intakeAnalysisResult } = useReport()
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

    saveSubmission({
      timestamp: new Date().toISOString(),
      formData: report,
      extraction: snapshot?.extraction ?? null,
      gaps: snapshot?.gaps ?? [],
      followUpQuestions: snapshot?.follow_up_questions ?? [],
    })
    generateReportPdf(report)
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

          <FormSection
            title="Incident Details"
            subtitle="What happened, when, where, and how you became aware of it."
          >
            <Incident />
          </FormSection>

          <div className={styles.submitArea}>
            {isProcessing && (
              <p className={styles.statusText}>{PIPELINE_LABELS[pipelineStatus]}</p>
            )}
            {hasError && (
              <p className={styles.statusError}>
                A pipeline step encountered an error. Please resolve or skip it in the questionnaire above.
              </p>
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
