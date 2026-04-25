import { useReport } from '@/context/ReportContext'
import type { ReportData } from '@/types/report'
import { YES_NO_OPTIONS } from '@/data/reportSchema'
import { FormField } from './FormField'
import { PhoneWithCodeInput } from './PhoneWithCodeInput'
import { RadioField } from './RadioField'
import styles from './ReporterPreferences.module.css'

export function ReporterPreferences() {
  const { report, updateReport } = useReport()
  const showContactFields = report.wish_anonymous === 'no'

  return (
    <>
      <RadioField
        name="is_employee"
        value={report.is_employee}
        options={YES_NO_OPTIONS}
        onChange={(v) => updateReport({ is_employee: v as ReportData['is_employee'] })}
        question="Are you an employee of the organization?"
      />
      <RadioField
        name="wish_anonymous"
        value={report.wish_anonymous}
        options={YES_NO_OPTIONS}
        onChange={(v) => updateReport({ wish_anonymous: v as ReportData['wish_anonymous'] })}
        question="Do you wish to remain ANONYMOUS for this report?"
      />

      {showContactFields && (
        <div className={styles.conditionalBlock}>
          <p className={styles.conditionalIntro}>
            If you want the organization to know your identity, please complete the following:
          </p>
          <div className={styles.nameRow}>
            <div className={styles.nameField}>
              <FormField
                label="First Name"
                value={report.reporter_first_name}
                onChange={(v) => updateReport({ reporter_first_name: v })}
              />
            </div>
            <div className={styles.nameField}>
              <FormField
                label="Last Name"
                value={report.reporter_last_name}
                onChange={(v) => updateReport({ reporter_last_name: v })}
              />
            </div>
          </div>
          <PhoneWithCodeInput
            label="Phone Number"
            codeValue={report.reporter_phone_code}
            numberValue={report.reporter_phone}
            onCodeChange={(v) => updateReport({ reporter_phone_code: v })}
            onNumberChange={(v) => updateReport({ reporter_phone: v })}
            country={report.country}
          />
          <FormField
            label="Email Address"
            value={report.reporter_email}
            onChange={(v) => updateReport({ reporter_email: v })}
          />
          <FormField
            label="Best time for communication"
            value={report.best_time_contact}
            onChange={(v) => updateReport({ best_time_contact: v })}
            type="textarea"
          />
        </div>
      )}
    </>
  )
}
