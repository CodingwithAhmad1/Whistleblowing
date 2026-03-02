import { useReport } from '@/context/ReportContext'
import { FormField } from './FormField'
import { PhoneWithCodeInput } from './PhoneWithCodeInput'
import styles from './ReporterPreferences.module.css'

const YES_NO_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
]

export function ReporterPreferences() {
  const { report, updateReport } = useReport()
  const showContactFields = report.wish_anonymous === 'no'

  return (
    <>
      <div className={styles.question}>
        <span className={styles.questionText}>Are you an employee of the organization?</span>
      </div>
      <div className={styles.radioRow}>
        {YES_NO_OPTIONS.map((opt) => (
          <label key={opt.value} className={styles.radioLabel}>
            <input
              type="radio"
              name="is_employee"
              value={opt.value}
              checked={report.is_employee === opt.value}
              onChange={() => updateReport({ is_employee: opt.value })}
              className={styles.radio}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

      <div className={styles.question}>
        <span className={styles.questionText}>Do you wish to remain ANONYMOUS for this report?</span>
      </div>
      <div className={styles.radioRow}>
        {YES_NO_OPTIONS.map((opt) => (
          <label key={opt.value} className={styles.radioLabel}>
            <input
              type="radio"
              name="wish_anonymous"
              value={opt.value}
              checked={report.wish_anonymous === opt.value}
              onChange={() => updateReport({ wish_anonymous: opt.value })}
              className={styles.radio}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>

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
            label="Your Phone Number"
            codeValue={report.reporter_phone_code}
            numberValue={report.reporter_phone}
            onCodeChange={(v) => updateReport({ reporter_phone_code: v })}
            onNumberChange={(v) => updateReport({ reporter_phone: v })}
            country={report.country}
          />
          <FormField
            label="Your Email Address"
            value={report.reporter_email}
            onChange={(v) => updateReport({ reporter_email: v })}
          />
          <FormField
            label="Best time for communication with you"
            value={report.best_time_contact}
            onChange={(v) => updateReport({ best_time_contact: v })}
            type="textarea"
          />
        </div>
      )}
    </>
  )
}
