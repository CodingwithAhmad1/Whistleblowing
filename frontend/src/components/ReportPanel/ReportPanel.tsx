import { OrganizationContext } from './sections/OrganizationContext'
import { ReporterPreferences } from './sections/ReporterPreferences'
import { ManagementAwareness } from './sections/ManagementAwareness'
import { Incident } from './sections/Incident'
import { FormSection } from './FormSection'
import { useReport } from '@/context/ReportContext'
import { generateReportPdf } from '@/utils/generateReportPdf'
import { saveSubmission } from '@/utils/feedStore'
import { API_CONFIG } from '@/config'
import styles from './ReportPanel.module.css'

const PIPELINE_LABELS: Record<string, string> = {
  analyzing: 'Analyzing your report\u2026',
  constructing: 'Building case summary\u2026',
  policyLoading: 'Finding relevant policy\u2026',
}

export function ReportPanel() {
  const { report, pipelineStatus } = useReport()

  const isProcessing = pipelineStatus === 'analyzing' || pipelineStatus === 'constructing' || pipelineStatus === 'policyLoading'
  const hasError = pipelineStatus === 'error'
  const canSubmit = !isProcessing && !hasError

  const handleSubmit = async () => {
    try {
      const res = await fetch(API_CONFIG.ENDPOINTS.ADMIN_LAST_ANALYSIS)
      if (res.ok) {
        const analysis = await res.json()
        saveSubmission({
          timestamp: new Date().toISOString(),
          formData: report,
          extraction: analysis.extraction ?? null,
          gaps: analysis.gaps ?? [],
          followUpQuestions: analysis.follow_up_questions ?? [],
        })
      }
    } catch (e) {
      console.error('[Feed] Snapshot save failed:', e)
    }
    generateReportPdf(report)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.scrollArea}>
        <div className={styles.formContent}>
          <header className={styles.header}>
            <h1 className={styles.title}>Whistleblower Report</h1>
          </header>
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
  )
}
