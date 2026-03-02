import { useReport } from '@/context/ReportContext'
import { FormField } from './FormField'
import { SearchableSelect } from './SearchableSelect'
import styles from './Incident.module.css'

const HOW_AWARE_OPTIONS = [
  { value: 'it_happened_to_me', label: 'It happened to me' },
  { value: 'i_observed_it', label: 'I observed it' },
  { value: 'i_heard_it', label: 'I heard it' },
  { value: 'told_by_coworker', label: 'Told to me by a co-worker' },
  { value: 'told_by_outside', label: 'Told to me by someone outside the company' },
  { value: 'overheard_it', label: 'Overheard it' },
  { value: 'accidentally_found_document', label: 'Accidentally found a document or file' },
  { value: 'other', label: 'Other' },
]

const DURATION_OPTIONS = [
  { value: 'once', label: 'Once' },
  { value: 'one_week', label: 'One week' },
  { value: '1_to_3_months', label: '1 to 3 months' },
  { value: '3_months_to_a_year', label: '3 months to a year' },
  { value: 'more_than_a_year', label: 'More than a year' },
  { value: 'don_t_know', label: "Don't know" },
]

export function Incident() {
  const { report, updateReport } = useReport()

  return (
    <>
      <FormField
        label="What is the general nature of this matter?"
        value={report.general_nature}
        onChange={(v) => updateReport({ general_nature: v })}
        type="textarea"
        rows={6}
        helperText="This should be a brief description only, you will be asked for specifics later."
      />
      <FormField
        label="Where did this incident or violation occur?"
        value={report.where_occurred}
        onChange={(v) => updateReport({ where_occurred: v })}
        type="textarea"
        rows={6}
        helperText="We recognize that this incident may not have occurred in a particular location. However, if this incident was observed in some documentation or business transactions, please indicate this accordingly."
      />
      <FormField
        label="Please provide the specific or approximate time this incident occurred:"
        value={report.when_occurred}
        onChange={(v) => updateReport({ when_occurred: v })}
        type="textarea"
        rows={6}
        helperText={'Examples:\n• Tuesday, May 3, 2002\n• Two weeks ago\n• Approximately a month ago'}
      />
      <SearchableSelect
        label="How long do you think this problem has been going on?"
        value={report.duration}
        onChange={(v) => updateReport({ duration: v })}
        options={DURATION_OPTIONS}
        placeholder=" - Select One - "
        selectOnly
      />
      <SearchableSelect
        label="How did you become aware of this violation?"
        value={report.how_aware}
        onChange={(v) => updateReport({ how_aware: v })}
        options={HOW_AWARE_OPTIONS}
        placeholder=" - Select One - "
        selectOnly
      />
      <FormField
        label="If other, how?"
        value={report.how_aware_other}
        onChange={(v) => updateReport({ how_aware_other: v })}
        type="textarea"
        rows={8}
      />
      <div className={styles.personsConcealingBlock}>
        <label className={styles.personsConcealingLabel}>
          Please identify any persons who have attempted to conceal this problem and the steps they took to conceal it:
        </label>
        <div className={styles.personsConcealingRow}>
          <div className={styles.personsConcealingField}>
            <textarea
              value={report.persons_concealing}
              onChange={(e) => updateReport({ persons_concealing: e.target.value })}
              placeholder=""
              className={styles.personsConcealingTextarea}
              rows={6}
              aria-label="Persons concealing"
            />
            <p className={styles.personsConcealingHelper}>Please identify by name and title.</p>
          </div>
          <div className={styles.personsConcealingExamples}>
            <div className={styles.personsConcealingExamplesTitle}>Examples:</div>
            <ul className={styles.personsConcealingExamplesList}>
              <li>Ignored it</li>
              <li>Changed documents</li>
              <li>Said it was not a problem</li>
              <li>Said they would look into it</li>
            </ul>
          </div>
        </div>
      </div>
      <FormField
        label="Full details (violation, witnesses, etc.)"
        value={report.full_details}
        onChange={(v) => updateReport({ full_details: v })}
        type="textarea"
        rows={20}
      />
    </>
  )
}
