import { useState } from 'react'
import type { StoredSubmission } from '@/utils/feedStore'
import { ReportView } from './ReportView'
import { SummaryView } from './SummaryView'
import styles from './SubmissionRow.module.css'

function formatReporter(formData: StoredSubmission['formData']): string {
  if (formData.wish_anonymous === 'yes') return 'Anonymous'
  const first = formData.reporter_first_name?.trim() ?? ''
  const last = formData.reporter_last_name?.trim() ?? ''
  if (first || last) return `${first} ${last}`.trim()
  return 'Blank Name'
}

function formatUtc(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  )
}

type Tab = 'report' | 'summary'

interface Props {
  submission: StoredSubmission
}

export function SubmissionRow({ submission }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('report')

  function toggle() {
    setIsOpen(prev => !prev)
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`}
        onClick={toggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        aria-expanded={isOpen}
      >
        <span className={styles.cellId}>#{submission.id}</span>
        <span className={styles.cellReporter}>{formatReporter(submission.formData)}</span>
        <span className={styles.cellDate}>{formatUtc(submission.timestamp)}</span>
      </div>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tab} ${activeTab === 'report' ? styles.tabActive : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('report') }}
            >
              Report
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('summary') }}
            >
              Summary
            </button>
          </div>
          <div className={styles.tabContent}>
            {activeTab === 'report' && (
              <ReportView formData={submission.formData} />
            )}
            {activeTab === 'summary' && (
              <SummaryView
                extraction={submission.extraction}
                followUpQuestions={submission.followUpQuestions}
                formData={submission.formData}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
