import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  loadSubmissions,
  deleteSubmission,
  SUBMISSIONS_STORAGE_KEY,
  SUBMISSIONS_UPDATED_EVENT,
  getLocalSubmissionsOnly,
  importLocalSubmissionsToServer,
  type StoredSubmission,
} from '@/utils/feedStore'
import { SubmissionRow } from '@/components/Feed/SubmissionRow'
import styles from './FeedPage.module.css'

function sortSubmissions(list: StoredSubmission[]) {
  return [...list].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function FeedPage() {
  const { pathname } = useLocation()
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const localOnlyCount = getLocalSubmissionsOnly().length

  const refresh = useCallback(async () => {
    const list = await loadSubmissions()
    setSubmissions(sortSubmissions(list))
  }, [])

  useEffect(() => {
    if (pathname !== '/feed') return
    setLoading(true)
    void (async () => {
      await refresh()
      setLoading(false)
    })()
  }, [pathname, refresh])

  useEffect(() => {
    if (pathname !== '/feed') return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onFocus = () => void refresh()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [pathname, refresh])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SUBMISSIONS_STORAGE_KEY) {
        void refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  useEffect(() => {
    window.addEventListener(SUBMISSIONS_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(SUBMISSIONS_UPDATED_EVENT, refresh)
  }, [refresh])

  async function handleDelete(id: number) {
    await deleteSubmission(id)
    await refresh()
  }

  async function handleImportLocal() {
    setImportStatus(null)
    setImporting(true)
    const r = await importLocalSubmissionsToServer()
    setImporting(false)
    if (r.ok) {
      setImportStatus(
        r.imported === 0
          ? 'No local-only rows to import.'
          : `Imported ${r.imported} submission(s) to the server.`,
      )
      await refresh()
    } else {
      setImportStatus(r.error ?? 'Import failed.')
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Submission Feed</h1>

      {localOnlyCount > 0 && (
        <div className={styles.localImportBanner} role="region" aria-label="Local-only submissions">
          <p className={styles.localImportText}>
            This browser has {localOnlyCount} report(s) stored only in local storage. Send them to the
            server so they appear in every browser and for MCP tools. Use the same dev URL
            (localhost vs 127.0.0.1) for the app and the API proxy.
          </p>
          <button
            type="button"
            className={styles.importButton}
            onClick={() => void handleImportLocal()}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Copy local reports to server'}
          </button>
          {importStatus && <p className={styles.importStatus}>{importStatus}</p>}
        </div>
      )}

      {loading ? (
        <p className={styles.loadingText}>Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No submissions yet</p>
          <p className={styles.emptyStateHint}>
            Submissions are saved to the server when the API is running, so every browser and the
            ReportIQ MCP share the same list. If the API is off, new reports stay in this browser
            only.
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
