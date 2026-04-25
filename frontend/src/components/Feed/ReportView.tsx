import { useState } from 'react'
import type { ReportData } from '@/types/report'
import { personsFromReport } from '@/types/report'
import { REPORT_FIELDS } from '@/data/reportSchema'
import personFormStyles from '@/components/ReportPanel/sections/ManagementAwareness.module.css'
import styles from './ReportView.module.css'

/** When person count exceeds this, show first N rows with See more. */
const PERSON_TABLE_INITIAL_ROWS = 5

const FULL_DETAILS_KEYS = new Set([
  'full_details_q1',
  'sequence_of_events',
  'evidence_description',
  'full_details_q2',
  'full_details_q3',
  'full_details_q2_question',
  'full_details_q3_question',
  'policy_quote_matched',
  'policy_section_matched',
  'constructed_sentence',
])

function getRaw(formData: ReportData, key: string): string {
  return ((formData as unknown as Record<string, string>)[key] ?? '').trim()
}

function getFormatted(formData: ReportData, key: string): string {
  const def = REPORT_FIELDS.find(f => f.key === key)
  const raw = getRaw(formData, key)
  if (!raw) return ''
  return def?.formatValue ? def.formatValue(raw) : raw
}

function FieldRow({ label, value, fieldKey }: { label: string; value: string; fieldKey: string }) {
  return (
    <div className={styles.fieldRow} key={fieldKey}>
      <span className={styles.label}>{label}</span>
      {value ? (
        <p className={styles.value}>{value}</p>
      ) : (
        <p className={styles.empty}>No response provided</p>
      )}
    </div>
  )
}

interface Props {
  formData: ReportData
}

export function ReportView({ formData }: Props) {
  const orgFields = REPORT_FIELDS.filter(f => f.section === 'organization')

  const reporterFields = REPORT_FIELDS.filter(
    f => f.section === 'reporter' && !f.hideWhen?.(formData),
  )

  const mgmtFields = REPORT_FIELDS.filter(
    f => f.section === 'persons' && !f.hideWhen?.(formData),
  )

  const incidentStandardFields = REPORT_FIELDS.filter(
    f =>
      f.section === 'incident' &&
      !FULL_DETAILS_KEYS.has(f.key) &&
      !f.hideWhen?.(formData),
  )

  const persons = personsFromReport(formData).filter(
    p => p.first.trim() || p.last.trim() || p.title.trim(),
  )

  const [showAllPersons, setShowAllPersons] = useState(false)
  const personCountExceedsInitial = persons.length > PERSON_TABLE_INITIAL_ROWS
  const displayedPersons =
    showAllPersons || !personCountExceedsInitial
      ? persons
      : persons.slice(0, PERSON_TABLE_INITIAL_ROWS)

  const q1 = getRaw(formData, 'full_details_q1')
  const sequence = getRaw(formData, 'sequence_of_events')
  const evidence = getRaw(formData, 'evidence_description')
  const q2 = getRaw(formData, 'full_details_q2')
  const q2q = getRaw(formData, 'full_details_q2_question')
  const q3 = getRaw(formData, 'full_details_q3')
  const q3q = getRaw(formData, 'full_details_q3_question')
  const policyQuote = getRaw(formData, 'policy_quote_matched')
  const policySection = getRaw(formData, 'policy_section_matched')
  const showQ2 = q2 || q2q
  const showQ3 = q3 || q3q

  return (
    <div>
      {/* 1. Organization & Context */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Organization &amp; Context</div>
        <div className={styles.card}>
          {orgFields.map(f => (
            <FieldRow key={f.key} fieldKey={f.key} label={f.label} value={getFormatted(formData, f.key)} />
          ))}
        </div>
      </div>

      {/* 2. Reporter Preferences */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Reporter Preferences</div>
        <div className={styles.card}>
          {reporterFields.map(f => (
            <FieldRow key={f.key} fieldKey={f.key} label={f.label} value={getFormatted(formData, f.key)} />
          ))}
        </div>
      </div>

      {/* 3. Persons Involved */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Persons Involved</div>
        {persons.length === 0 ? (
          <p className={styles.empty}>No persons identified</p>
        ) : (
          <div className={styles.personsBlock}>
            <div className={personFormStyles.personRows}>
              {displayedPersons.map((p, i) => (
                <div key={i} className={personFormStyles.personRowRead}>
                  <span className={personFormStyles.rowLabel}>#{i + 1}</span>
                  <div className={personFormStyles.readOnlyField}>{p.first || '—'}</div>
                  <div className={personFormStyles.readOnlyField}>{p.last || '—'}</div>
                  <div className={personFormStyles.readOnlyTitle}>{p.title || '—'}</div>
                </div>
              ))}
            </div>
            {personCountExceedsInitial && (
              <button
                type="button"
                className={styles.personsSeeMore}
                onClick={() => setShowAllPersons(v => !v)}
              >
                {showAllPersons ? 'See less' : 'See more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Management Awareness */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Management Awareness</div>
        <div className={styles.card}>
          {mgmtFields.map(f => (
            <FieldRow key={f.key} fieldKey={f.key} label={f.label} value={getFormatted(formData, f.key)} />
          ))}
        </div>
      </div>

      {/* 5. Incident Details */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Incident Details</div>
        <div className={styles.card}>
          {incidentStandardFields.map(f => (
            <FieldRow key={f.key} fieldKey={f.key} label={f.label} value={getFormatted(formData, f.key)} />
          ))}
        </div>
      </div>

      {/* 6. Full Details */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Full Details</div>

        {/* Q1 — narrative */}
        <div className={styles.qaBlock}>
          <p className={styles.qaQuestion}>Please describe what happened in your own words.</p>
          {q1 ? (
            <p className={styles.qaAnswer}>{q1}</p>
          ) : (
            <p className={styles.empty}>No response provided</p>
          )}
        </div>

        {/* Q2 — sequence of events */}
        {sequence && (
          <div className={styles.qaBlock}>
            <p className={styles.qaQuestion}>Sequence of events — what happened first and what happened next?</p>
            <p className={styles.qaAnswer}>{sequence}</p>
          </div>
        )}

        {/* Q3 — evidence */}
        {evidence && formData.has_supporting_materials !== 'no' && (
          <div className={styles.qaBlock}>
            <p className={styles.qaQuestion}>Supporting evidence or materials</p>
            <p className={styles.qaAnswer}>{evidence}</p>
          </div>
        )}

        {/* Q4 — AI follow-up */}
        {showQ2 && (
          <div className={styles.qaBlock}>
            <p className={styles.qaQuestion}>{q2q || 'Follow-up question'}</p>
            {q2 ? (
              <p className={styles.qaAnswer}>{q2}</p>
            ) : (
              <p className={styles.empty}>No response provided</p>
            )}
          </div>
        )}

        {/* Q3 */}
        {showQ3 && (
          <div className={styles.qaBlock}>
            {policyQuote && (
              <blockquote className={styles.policyQuote}>
                &ldquo;{policyQuote}&rdquo;
                {policySection && (
                  <span className={styles.policyCitation}>— {policySection}</span>
                )}
              </blockquote>
            )}
            <p className={styles.qaQuestion}>{q3q || 'Policy question'}</p>
            {q3 ? (
              <p className={styles.qaAnswer}>{q3}</p>
            ) : (
              <p className={styles.empty}>No response provided</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
