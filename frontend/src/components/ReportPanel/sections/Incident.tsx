import { useReport } from '@/context/ReportContext'
import { DURATION_OPTIONS, HOW_AWARE_OPTIONS, YES_NO_OPTIONS } from '@/data/reportSchema'
import { EVIDENCE_DESCRIPTION_LABEL } from '@/data/incidentIntakeCopy'
import type { ReportData } from '@/types/report'
import { FormField } from './FormField'
import { SearchableSelect } from './SearchableSelect'
import { FullDetailsQuestionnaire } from './FullDetailsQuestionnaire'
import { RadioField } from './RadioField'
import styles from './Incident.module.css'

export function Incident() {
  const { report, updateReport } = useReport()

  return (
    <>
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
        rows={2}
        textareaClassName={styles.timeOccurredTextarea}
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
        label="Please describe the incident in detail, in the order that events took place—what happened first, what happened next, and the main facts (who, what, when, and where) that you are able to share."
        value={report.general_nature}
        onChange={(v) => updateReport({ general_nature: v })}
        type="textarea"
        rows={6}
        helperText="A clear, chronological account helps us review your report fairly. Include what you know to be true, as precisely as you can, even if some details are still uncertain."
      />
      <RadioField
        name="has_supporting_materials"
        value={report.has_supporting_materials}
        options={YES_NO_OPTIONS}
        onChange={(v) => updateReport({ has_supporting_materials: v as ReportData['has_supporting_materials'] })}
        question="Do you have any supporting materials (documents, emails, photos, or other evidence) to provide?"
      />
      {report.has_supporting_materials === 'yes' && (
        <FormField
          label={EVIDENCE_DESCRIPTION_LABEL}
          value={report.evidence_description}
          onChange={(v) => updateReport({ evidence_description: v })}
          type="textarea"
          rows={8}
          placeholder="Type your answer here…"
        />
      )}
      <FullDetailsQuestionnaire />
    </>
  )
}
