import { useMemo, useState, useEffect } from 'react'
import { useReport } from '@/context/ReportContext'
import { FormField } from './FormField'
import {
  personsFromReport,
  reportUpdatesFromPersons,
  MAX_PERSONS,
  type PersonRecord,
} from '@/types/report'
import styles from './ManagementAwareness.module.css'

const SUPERVISOR_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
  { value: 'do_not_know' as const, label: 'Do Not Know / Do Not Wish To Disclose' },
]

const MANAGEMENT_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
  { value: 'do_not_know' as const, label: 'Do Not Know / Do Not Wish To Disclose' },
]

function personHasData(p: PersonRecord): boolean {
  return Boolean(p.first.trim() || p.last.trim() || p.title.trim())
}

function getMinVisibleFromReport(report: Record<string, string | undefined>): number {
  const persons = personsFromReport(report)
  let lastWithData = -1
  for (let i = 0; i < persons.length; i++) {
    if (personHasData(persons[i])) lastWithData = i
  }
  return Math.max(3, lastWithData + 1)
}

function PersonRow({
  index,
  first,
  last,
  title,
  onFirst,
  onLast,
  onTitle,
  onRemove,
  canRemove,
}: {
  index: number
  first: string
  last: string
  title: string
  onFirst: (v: string) => void
  onLast: (v: string) => void
  onTitle: (v: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className={styles.personRow}>
      <span className={styles.rowLabel}>#{index}</span>
      <input
        type="text"
        value={first}
        onChange={(e) => onFirst(e.target.value)}
        placeholder="First Name"
        className={styles.shortInput}
        aria-label={`Person ${index} first name`}
      />
      <input
        type="text"
        value={last}
        onChange={(e) => onLast(e.target.value)}
        placeholder="Last Name"
        className={styles.shortInput}
        aria-label={`Person ${index} last name`}
      />
      <input
        type="text"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Title"
        className={styles.titleInput}
        aria-label={`Person ${index} title`}
      />
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className={styles.removeButton}
          aria-label={`Remove person ${index}`}
        >
          Remove
        </button>
      ) : (
        <span className={styles.removeSpacer} />
      )}
    </div>
  )
}

export function ManagementAwareness() {
  const { report, updateReport } = useReport()
  const showSupervisorWho = report.supervisor_involved === 'yes'

  const minFromReport = useMemo(
    () => getMinVisibleFromReport(report as unknown as Record<string, string | undefined>),
    [report]
  )
  const [minVisibleCount, setMinVisibleCount] = useState(minFromReport)

  useEffect(() => {
    setMinVisibleCount((prev) => Math.max(prev, minFromReport))
  }, [minFromReport])

  const visiblePersons = useMemo(() => {
    const all = personsFromReport(report as unknown as Record<string, string | undefined>)
    const count = Math.min(MAX_PERSONS, Math.max(minVisibleCount, minFromReport))
    return all.slice(0, count)
  }, [report, minVisibleCount, minFromReport])

  const firstThreeHaveFirstName =
    visiblePersons.length >= 3 &&
    visiblePersons.slice(0, 3).every((p) => p.first.trim() !== '')
  const canAddMore =
    visiblePersons.length < MAX_PERSONS &&
    (visiblePersons.length > 3 || firstThreeHaveFirstName)

  const handlePersonChange = (index: number, field: keyof PersonRecord, value: string) => {
    const next = [...visiblePersons]
    if (!next[index]) return
    next[index] = { ...next[index], [field]: value }
    updateReport(reportUpdatesFromPersons(next))
  }

  const handleAddPerson = () => {
    setMinVisibleCount((prev) => Math.min(prev + 1, MAX_PERSONS))
    const next = [...visiblePersons, { first: '', last: '', title: '' }]
    updateReport(reportUpdatesFromPersons(next))
  }

  const handleRemovePerson = (index: number) => {
    const next = visiblePersons.filter((_, i) => i !== index)
    if (next.length < 3) return
    setMinVisibleCount((prev) => Math.max(3, prev - 1))
    updateReport(reportUpdatesFromPersons(next))
  }

  return (
    <>
      <div className={styles.section}>
        <div className={styles.question}>
          <span className={styles.questionText}>
            Please identify the person(s) engaged in this behavior:
          </span>
        </div>
        <p className={styles.examples}>
          Examples: &quot;John Doe, Director of Internal Audit&quot; / &quot;Unknown, Unknown, Night Supervisor&quot;
        </p>
        <div className={styles.personRows}>
          {visiblePersons.map((person, i) => (
            <PersonRow
              key={i}
              index={i + 1}
              first={person.first}
              last={person.last}
              title={person.title}
              onFirst={(v) => handlePersonChange(i, 'first', v)}
              onLast={(v) => handlePersonChange(i, 'last', v)}
              onTitle={(v) => handlePersonChange(i, 'title', v)}
              onRemove={() => handleRemovePerson(i)}
              canRemove={visiblePersons.length > 3}
            />
          ))}
          {visiblePersons.length < MAX_PERSONS && (
            <button
              type="button"
              onClick={handleAddPerson}
              disabled={!canAddMore}
              className={styles.addButton}
              aria-label="Add another person"
              title={
                !canAddMore
                  ? 'Fill first name for each of the first three persons to add more'
                  : undefined
              }
            >
              + Add another person
            </button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.question}>
          <span className={styles.questionText}>
            Do you suspect or know that a supervisor or management is involved?
          </span>
        </div>
        <div className={styles.radioRow}>
          {SUPERVISOR_OPTIONS.map((opt) => (
            <label key={opt.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="supervisor_involved"
                value={opt.value}
                checked={report.supervisor_involved === opt.value}
                onChange={() => updateReport({ supervisor_involved: opt.value })}
                className={styles.radio}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        {showSupervisorWho && (
          <>
            <p className={styles.conditionalLabel}>If yes, then who?</p>
            <FormField
              label=""
              value={report.supervisor_who}
              onChange={(v) => updateReport({ supervisor_who: v })}
              type="textarea"
              placeholder="e.g. John Doe, Director of Internal Audit"
            />
            <p className={styles.disclaimer}>
              Any persons mentioned here will be restricted from access to this reported information.
            </p>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.question}>
          <span className={styles.questionText}>Is management aware of this problem?</span>
        </div>
        <div className={styles.radioRow}>
          {MANAGEMENT_OPTIONS.map((opt) => (
            <label key={opt.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="management_aware"
                value={opt.value}
                checked={report.management_aware === opt.value}
                onChange={() => updateReport({ management_aware: opt.value })}
                className={styles.radio}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
