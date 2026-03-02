import { OrganizationContext } from './sections/OrganizationContext'
import { ReporterPreferences } from './sections/ReporterPreferences'
import { ManagementAwareness } from './sections/ManagementAwareness'
import { Incident } from './sections/Incident'
import { FormSection } from './FormSection'
import { useReport } from '@/context/ReportContext'
import { generateReportPdf } from '@/utils/generateReportPdf'
import styles from './ReportPanel.module.css'

export function ReportPanel() {
  const { report } = useReport()

  const handleSubmit = () => {
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

          <button
            type="button"
            onClick={handleSubmit}
            className={styles.submitButton}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}
