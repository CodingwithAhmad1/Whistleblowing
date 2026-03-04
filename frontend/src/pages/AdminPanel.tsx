/**
 * Admin panel: view all sessions, their report data, and conversation history.
 */
import { useEffect, useState, useCallback } from 'react'
import { API_CONFIG } from '@/config'
import styles from './AdminPanel.module.css'

interface SessionSummary {
  session_id: string
  created_at: string
  message_count: number
  fields_filled: number
  report_data: Record<string, string>
}

interface SessionDetail extends SessionSummary {
  conversation_history: Array<{ role: string; content: string; timestamp: string }>
}

const FIELD_LABELS: Record<string, string> = {
  organization_tier: 'Organization / Tier',
  country: 'Country',
  incident_location: 'Incident Location',
  is_employee: 'Is Employee',
  wish_anonymous: 'Wishes Anonymity',
  reporter_first_name: 'Reporter First Name',
  reporter_last_name: 'Reporter Last Name',
  reporter_phone_code: 'Phone Code',
  reporter_phone: 'Phone',
  reporter_email: 'Email',
  best_time_contact: 'Best Time to Contact',
  supervisor_involved: 'Supervisor Involved',
  supervisor_who: 'Supervisor Name',
  management_aware: 'Management Aware',
  general_nature: 'Nature of Matter',
  where_occurred: 'Where Occurred',
  when_occurred: 'When Occurred',
  duration: 'Duration',
  how_aware: 'How Became Aware',
  how_aware_other: 'How Aware (Other)',
  full_details: 'Full Details',
  persons_concealing: 'Persons Concealing',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function ReportDataTable({ data }: { data: Record<string, string> }) {
  const entries = Object.entries(data).filter(([, v]) => v && v.trim())
  if (entries.length === 0) return <p className={styles.empty}>No fields filled yet.</p>
  return (
    <table className={styles.reportTable}>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td className={styles.fieldLabel}>{FIELD_LABELS[key] ?? key}</td>
            <td className={styles.fieldValue}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ConversationHistory({ history }: { history: SessionDetail['conversation_history'] }) {
  if (history.length === 0) return <p className={styles.empty}>No messages yet.</p>
  return (
    <div className={styles.history}>
      {history.map((msg, i) => (
        <div key={i} className={`${styles.historyMsg} ${msg.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
          <span className={styles.msgRole}>{msg.role === 'user' ? 'Reporter' : 'AI'}</span>
          <p className={styles.msgContent}>{msg.content}</p>
          {msg.timestamp && <span className={styles.msgTime}>{formatDate(msg.timestamp)}</span>}
        </div>
      ))}
    </div>
  )
}

function SessionRow({
  session,
  onSelect,
  selected,
}: {
  session: SessionSummary
  onSelect: (id: string) => void
  selected: boolean
}) {
  const pct = Math.round((session.fields_filled / 48) * 100)
  return (
    <tr
      className={`${styles.sessionRow} ${selected ? styles.sessionRowSelected : ''}`}
      onClick={() => onSelect(session.session_id)}
    >
      <td className={styles.sessionId}>{session.session_id.slice(0, 24)}…</td>
      <td>{formatDate(session.created_at)}</td>
      <td className={styles.centered}>{session.message_count}</td>
      <td>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.progressLabel}>{session.fields_filled}/48</span>
      </td>
    </tr>
  )
}

export function AdminPanel() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [detailTab, setDetailTab] = useState<'report' | 'chat'>('report')
  const [deleting, setDeleting] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/admin/sessions`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setSessions(data.sessions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDetail = useCallback(async (id: string) => {
    setDetail(null)
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/api/admin/sessions/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDetail(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session detail')
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`${API_CONFIG.BASE_URL}/api/admin/sessions/${id}`, { method: 'DELETE' })
      setSelectedId(null)
      setDetail(null)
      await fetchSessions()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }, [fetchSessions])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    setDetailTab('report')
    fetchDetail(id)
  }, [fetchDetail])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Admin Panel</h1>
          <span className={styles.subtitle}>ReportIQ — Session Management</span>
        </div>
        <div className={styles.headerRight}>
          <a href="/" className={styles.backLink}>← Back to Report Form</a>
          <button className={styles.refreshBtn} onClick={fetchSessions} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.layout}>
        {/* Session list */}
        <section className={styles.listPane}>
          <h2 className={styles.paneTitle}>
            Sessions <span className={styles.count}>({sessions.length})</span>
          </h2>
          {loading && sessions.length === 0 ? (
            <p className={styles.empty}>Loading…</p>
          ) : sessions.length === 0 ? (
            <p className={styles.empty}>No sessions yet. Start a report to see sessions here.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.sessionsTable}>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Created</th>
                    <th className={styles.centered}>Messages</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <SessionRow
                      key={s.session_id}
                      session={s}
                      onSelect={handleSelect}
                      selected={s.session_id === selectedId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Session detail */}
        <section className={styles.detailPane}>
          {!selectedId ? (
            <div className={styles.detailEmpty}>
              <p>Select a session to view details.</p>
            </div>
          ) : !detail ? (
            <p className={styles.empty}>Loading session…</p>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>Session Detail</h2>
                  <p className={styles.detailMeta}>
                    Created: {formatDate(detail.created_at)} &nbsp;·&nbsp;
                    {detail.message_count} messages &nbsp;·&nbsp;
                    {detail.fields_filled}/48 fields filled
                  </p>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(detail.session_id)}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete Session'}
                </button>
              </div>

              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${detailTab === 'report' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('report')}
                >
                  Report Data ({detail.fields_filled} fields)
                </button>
                <button
                  className={`${styles.tab} ${detailTab === 'chat' ? styles.tabActive : ''}`}
                  onClick={() => setDetailTab('chat')}
                >
                  Conversation ({detail.message_count} messages)
                </button>
              </div>

              <div className={styles.tabContent}>
                {detailTab === 'report' ? (
                  <ReportDataTable data={detail.report_data} />
                ) : (
                  <ConversationHistory history={detail.conversation_history} />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
