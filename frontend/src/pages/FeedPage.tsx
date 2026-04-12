import { useState } from 'react'
import { loadSubmissions, deleteSubmission } from '@/utils/feedStore'
import { SubmissionRow } from '@/components/Feed/SubmissionRow'
import styles from './FeedPage.module.css'

export function FeedPage() {
  const [submissions, setSubmissions] = useState(() =>
    loadSubmissions().sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    ),
  )

  function handleDelete(id: number) {
    deleteSubmission(id)
    setSubmissions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Submission Feed</h1>
      <p className={styles.subtitle}>Review submitted whistleblowing reports.</p>
      <p className={styles.disclosure} role="note">
        Prototype notice: submissions are stored only in this browser&apos;s local storage. They are not encrypted,
        are not sent to a server, and are not suitable as an official compliance or investigation record. Clearing
        site data or using another device will hide them here.
      </p>

      {submissions.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No submissions yet</p>
          <p className={styles.emptyStateHint}>
            Submissions will appear here once a report is filed in Reporter mode.
          </p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span className={styles.thCell}>#</span>
            <span className={styles.thCell}>Reporter</span>
            <span className={styles.thCellRight}>Submitted (UTC)</span>
            <span aria-hidden="true" />
          </div>
          <div className={styles.tableBody}>
            {submissions.map(s => (
              <SubmissionRow key={s.id} submission={s} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
