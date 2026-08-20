import { useState, type MouseEvent } from 'react'
import type { StoredSubmission } from '@/utils/feedStore'
import { generateSubmissionPdf } from '@/utils/generateReportPdf'
import { ReportView } from './ReportView'
import { SummaryView } from './SummaryView'
import { DeleteConfirmModal } from './DeleteConfirmModal'
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
  onDelete: (id: number) => void
}

export function SubmissionRow({ submission, onDelete }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('report')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  function toggle() {
    setIsOpen(prev => !prev)
  }

  function handleDownloadPdf(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    generateSubmissionPdf(submission)
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
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={handleDownloadPdf}
            aria-label={`Download PDF for report #${submission.id}`}
            title="Download PDF"
          >
            <svg
              className={styles.downloadIcon}
              viewBox="0 0 24 24"
              width={16}
              height={16}
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth={1.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3.5v7" />
              <path d="M7.5 10.5 12 15 16.5 10.5" />
              <path d="M4.5 20h15" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }}
            aria-label={`Delete report #${submission.id}`}
            title="Delete report"
          >
            &times;
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteConfirmModal
          submissionId={submission.id}
          onConfirm={() => { setShowDeleteModal(false); onDelete(submission.id) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

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
                extractionBreakdown={submission.extractionBreakdown}
                followUpQuestions={submission.followUpQuestions}
                coverage={submission.coverage}
                formData={submission.formData}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
