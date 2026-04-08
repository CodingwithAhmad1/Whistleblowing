import { useMemo } from 'react'
import { loadSubmissions } from '@/utils/feedStore'
import { SubmissionRow } from '@/components/Feed/SubmissionRow'
import styles from './FeedPage.module.css'

export function FeedPage() {
  const submissions = useMemo(
    () =>
      loadSubmissions().sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [],
  )

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Submission Feed</h1>
      <p className={styles.subtitle}>Review submitted whistleblowing reports.</p>

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
          </div>
          <div className={styles.tableBody}>
            {submissions.map(s => (
              <SubmissionRow key={s.id} submission={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
