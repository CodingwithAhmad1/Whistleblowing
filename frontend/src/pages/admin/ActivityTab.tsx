import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_CONFIG } from '@/config'
import type {
  ActivityMetrics,
  AmendmentConfig,
  AmendmentProposal,
  AnalyzeResult,
  DiffSpan,
} from '@/types/activity'
import styles from './ActivityTab.module.css'

const BASE = API_CONFIG.BASE_URL

const CLASS_LABELS: Record<string, string> = {
  covered: 'Covered',
  legal_only: 'Legal only (policy gap)',
  policy_only: 'Policy only',
  uncovered: 'Uncovered',
  unclassified: 'Unclassified',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  modified: 'statusModified',
  rejected: 'statusRejected',
}

/** Render text with highlighted spans (server-computed diff — never LLM-claimed). */
function renderWithSpans(
  text: string,
  spans: [number, number][],
  markClass: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let cursor = 0
  const sorted = [...spans].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0])
  sorted.forEach(([start, end], i) => {
    if (start > cursor) nodes.push(<span key={`t${i}`}>{text.slice(cursor, start)}</span>)
    nodes.push(
      <mark key={`m${i}`} className={markClass}>
        {text.slice(start, end)}
      </mark>,
    )
    cursor = Math.max(cursor, end)
  })
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>)
  return nodes
}

function refLabel(ref: { corpus: string; document_id: string | null; section: string | null } | null): string {
  if (!ref) return ''
  const parts = [ref.corpus === 'legal' ? 'Legal' : 'Policy', ref.document_id, ref.section]
  return parts.filter(Boolean).join(' · ')
}

function ProposalCard({
  proposal,
  onDecide,
}: {
  proposal: AmendmentProposal
  onDecide: (id: string, action: 'accept' | 'modify' | 'reject', modifiedText?: string, reason?: string) => Promise<void>
}) {
  const [modifyOpen, setModifyOpen] = useState(false)
  const [modifiedText, setModifiedText] = useState(proposal.proposed_text ?? '')
  const [rejectPending, setRejectPending] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState(false)

  const anchorSpans = useMemo(
    () =>
      proposal.diff_spans
        .filter((s: DiffSpan) => s.op === 'replace' || s.op === 'delete')
        .map((s) => s.anchor_span),
    [proposal.diff_spans],
  )
  const proposedSpans = useMemo(
    () =>
      proposal.diff_spans
        .filter((s: DiffSpan) => s.op === 'replace' || s.op === 'insert')
        .map((s) => s.proposed_span),
    [proposal.diff_spans],
  )

  const decide = async (action: 'accept' | 'modify' | 'reject') => {
    setBusy(true)
    try {
      await onDecide(
        proposal.proposal_id,
        action,
        action === 'modify' ? modifiedText : undefined,
        action === 'reject' ? rejectReason : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  const isNotice = proposal.kind === 'coverage_notice'
  const decided = proposal.status !== 'pending'

  return (
    <article className={`${styles.card} ${isNotice ? styles.noticeCard : ''}`}>
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[proposal.status]]}`}>
            {proposal.status}
          </span>
          <span className={styles.kindLabel}>
            {isNotice ? 'Coverage-gap notice' : 'Amendment proposal'}
          </span>
          <span className={styles.proposalId}>{proposal.proposal_id}</span>
        </div>
        <span className={styles.evidenceLine}>
          {proposal.contributing_submission_ids.length} report
          {proposal.contributing_submission_ids.length === 1 ? '' : 's'} · cluster {proposal.cluster_id}
        </span>
      </header>

      {isNotice ? (
        <p className={styles.noticeText}>{proposal.notice}</p>
      ) : (
        <div className={styles.diffColumns}>
          <div className={styles.diffCol}>
            <h4 className={styles.diffColTitle}>Current clause (verbatim)</h4>
            <blockquote className={styles.anchorQuote}>
              {renderWithSpans(proposal.anchor_text ?? '', anchorSpans, styles.markDeleted)}
            </blockquote>
            {proposal.anchor_ref && (
              <p className={styles.citation}>— {refLabel(proposal.anchor_ref)}</p>
            )}
          </div>
          <div className={styles.diffCol}>
            <h4 className={styles.diffColTitle}>Proposed revision</h4>
            <blockquote className={styles.proposedQuote}>
              {renderWithSpans(proposal.proposed_text ?? '', proposedSpans, styles.markInserted)}
            </blockquote>
          </div>
        </div>
      )}

      {proposal.rationale && (
        <p className={styles.rationale}>
          <span className={styles.aiLabel}>AI rationale (model interpretation)</span>
          {proposal.rationale}
        </p>
      )}

      <footer className={styles.provenance}>
        {proposal.legal_ref && <span>Legal basis: {refLabel(proposal.legal_ref)}</span>}
        <span>
          Reports: {proposal.contributing_submission_ids.map((id) => `#${id}`).join(', ')}
        </span>
        <span>Created {new Date(proposal.created_at).toLocaleString()}</span>
      </footer>

      {decided && proposal.reviewer_decision && (
        <p className={styles.decisionLog}>
          Reviewer {proposal.reviewer_decision.action}ed
          {proposal.reviewer_decision.reason ? ` — “${proposal.reviewer_decision.reason}”` : ''} on{' '}
          {new Date(proposal.reviewer_decision.decided_at).toLocaleString()}
          {proposal.reviewer_decision.modified_text && (
            <>
              <br />
              Final text: <em>{proposal.reviewer_decision.modified_text}</em>
            </>
          )}
        </p>
      )}

      {!decided && !isNotice && (
        <div className={styles.actions}>
          <button type="button" className={styles.acceptBtn} disabled={busy} onClick={() => decide('accept')}>
            Accept
          </button>
          <button
            type="button"
            className={styles.modifyBtn}
            disabled={busy}
            onClick={() => setModifyOpen((v) => !v)}
          >
            {modifyOpen ? 'Close' : 'Modify'}
          </button>
          {!rejectPending ? (
            <button type="button" className={styles.rejectBtn} disabled={busy} onClick={() => setRejectPending(true)}>
              Reject
            </button>
          ) : (
            <span className={styles.rejectConfirm}>
              <input
                type="text"
                className={styles.rejectReasonInput}
                placeholder="Reason (required — feeds tuning)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <button
                type="button"
                className={styles.rejectBtnConfirm}
                disabled={busy || !rejectReason.trim()}
                onClick={() => decide('reject')}
              >
                Confirm reject
              </button>
              <button type="button" className={styles.cancelBtn} disabled={busy} onClick={() => setRejectPending(false)}>
                Cancel
              </button>
            </span>
          )}
        </div>
      )}

      {!decided && modifyOpen && !isNotice && (
        <div className={styles.modifyArea}>
          <textarea
            className={styles.modifyTextarea}
            rows={5}
            value={modifiedText}
            onChange={(e) => setModifiedText(e.target.value)}
          />
          <button
            type="button"
            className={styles.acceptBtn}
            disabled={busy || !modifiedText.trim()}
            onClick={() => decide('modify')}
          >
            Save modified text
          </button>
        </div>
      )}
    </article>
  )
}

export function ActivityTab() {
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null)
  const [proposals, setProposals] = useState<AmendmentProposal[]>([])
  const [config, setConfig] = useState<AmendmentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [configDraft, setConfigDraft] = useState<AmendmentConfig | null>(null)
  const [configSaving, setConfigSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, pRes, cRes] = await Promise.all([
        fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_METRICS}`),
        fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_PROPOSALS}`),
        fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_CONFIG}`),
      ])
      if (!mRes.ok || !pRes.ok || !cRes.ok) throw new Error('Failed to load activity data')
      setMetrics(await mRes.json())
      setProposals((await pRes.json()).proposals ?? [])
      const cfg = await cRes.json()
      setConfig(cfg)
      setConfigDraft(cfg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const runAnalysis = async () => {
    setAnalyzing(true)
    setError(null)
    setAnalyzeResult(null)
    try {
      const res = await fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_ANALYZE}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
      setAnalyzeResult(await res.json())
      await fetchAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyze failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const decide = async (
    id: string,
    action: 'accept' | 'modify' | 'reject',
    modifiedText?: string,
    reason?: string,
  ) => {
    const res = await fetch(
      `${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_PROPOSALS}/${id}/decision`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, modified_text: modifiedText ?? null, reason: reason ?? null }),
      },
    )
    if (!res.ok) {
      setError(`Decision failed: ${res.status}`)
      return
    }
    const updated: AmendmentProposal = await res.json()
    setProposals((prev) => prev.map((p) => (p.proposal_id === id ? updated : p)))
    // Refresh standing figures after a decision
    fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_METRICS}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m && setMetrics(m))
      .catch(() => {})
  }

  const saveConfig = async () => {
    if (!configDraft) return
    setConfigSaving(true)
    try {
      const res = await fetch(`${BASE}${API_CONFIG.ENDPOINTS.ACTIVITY_CONFIG}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configDraft),
      })
      if (!res.ok) throw new Error(`Config save failed: ${res.status}`)
      const cfg = await res.json()
      setConfig(cfg)
      setConfigDraft(cfg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Config save failed')
    } finally {
      setConfigSaving(false)
    }
  }

  if (loading) {
    return <p className={styles.loadingText}>Loading activity…</p>
  }

  const notices = proposals.filter((p) => p.kind === 'coverage_notice')
  const amendments = proposals.filter((p) => p.kind === 'amendment')

  return (
    <div>
      <section>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>Policy Amendment Activity</h2>
            <p className={styles.sectionDesc}>
              Reports the firm's policy fails to cover accumulate into clusters; each candidate cluster
              yields an anchored amendment proposal for review. Proposals never change the policy —
              every decision here is logged.
            </p>
          </div>
          <button type="button" className={styles.analyzeBtn} onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? 'Analyzing…' : 'Analyze now'}
          </button>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}{' '}
            <button type="button" className={styles.retryBtn} onClick={fetchAll}>
              Retry
            </button>
          </p>
        )}

        {analyzeResult && (
          <p className={styles.analyzeSummary} role="status">
            Considered {analyzeResult.inputs_considered} coverage-gap report
            {analyzeResult.inputs_considered === 1 ? '' : 's'} → {analyzeResult.clusters.length} cluster
            {analyzeResult.clusters.length === 1 ? '' : 's'}; {analyzeResult.proposals_created} proposal
            {analyzeResult.proposals_created === 1 ? '' : 's'}, {analyzeResult.notices_created} notice
            {analyzeResult.notices_created === 1 ? '' : 's'} created
            {analyzeResult.skipped_existing > 0 ? `, ${analyzeResult.skipped_existing} skipped (already proposed)` : ''}.
            {analyzeResult.generation_failures > 0 && (
              <strong>
                {' '}
                {analyzeResult.generation_failures} cluster
                {analyzeResult.generation_failures === 1 ? '' : 's'} could not be processed (AI
                unavailable) — run again later.
              </strong>
            )}
          </p>
        )}
      </section>

      {metrics && (
        <section className={styles.metricsStrip}>
          <div className={styles.metricTile}>
            <span className={styles.metricValue}>
              {metrics.legal_only_rate !== null ? `${Math.round(metrics.legal_only_rate * 100)}%` : '—'}
            </span>
            <span className={styles.metricLabel}>
              legal-only rate (law covers it, policy doesn't) · standing figure, last {metrics.window_days}d
            </span>
          </div>
          {(['covered', 'legal_only', 'policy_only', 'uncovered'] as const).map((cls) => (
            <div key={cls} className={styles.metricTile}>
              <span className={styles.metricValue}>{metrics.counts[cls] ?? 0}</span>
              <span className={styles.metricLabel}>{CLASS_LABELS[cls]}</span>
            </div>
          ))}
          <div className={styles.metricTile}>
            <span className={styles.metricValue}>
              {metrics.proposals.unanchored_rejection_rate !== null
                ? `${Math.round(metrics.proposals.unanchored_rejection_rate * 100)}%`
                : '—'}
            </span>
            <span className={styles.metricLabel}>unanchored-rejection rate (constraint binding)</span>
          </div>
        </section>
      )}

      {configDraft && (
        <section className={styles.configRow}>
          <span className={styles.configLabel}>Cluster gates:</span>
          <label className={styles.configField}>
            n<sub>min</sub>
            <input
              type="number"
              min={1}
              value={configDraft.nMin}
              onChange={(e) => setConfigDraft({ ...configDraft, nMin: Number(e.target.value) })}
            />
          </label>
          <label className={styles.configField}>
            sim<sub>min</sub>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.05}
              value={configDraft.simMin}
              onChange={(e) => setConfigDraft({ ...configDraft, simMin: Number(e.target.value) })}
            />
          </label>
          <label className={styles.configField}>
            window (days)
            <input
              type="number"
              min={1}
              value={configDraft.windowDays}
              onChange={(e) => setConfigDraft({ ...configDraft, windowDays: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            className={styles.configSaveBtn}
            disabled={configSaving || JSON.stringify(configDraft) === JSON.stringify(config)}
            onClick={saveConfig}
          >
            {configSaving ? 'Saving…' : 'Save gates'}
          </button>
        </section>
      )}

      {amendments.length === 0 && notices.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateText}>No proposals yet.</p>
          <p className={styles.emptyStateHint}>
            Proposals appear when enough similar coverage-gap reports (legal-only or uncovered)
            accumulate within the window. Run “Analyze now” after new submissions arrive.
          </p>
        </div>
      ) : (
        <>
          {amendments.length > 0 && (
            <section className={styles.cardList}>
              {amendments.map((p) => (
                <ProposalCard key={p.proposal_id} proposal={p} onDecide={decide} />
              ))}
            </section>
          )}
          {notices.length > 0 && (
            <section>
              <h3 className={styles.noticesTitle}>Coverage-gap notices (no anchor — no text proposed)</h3>
              <div className={styles.cardList}>
                {notices.map((p) => (
                  <ProposalCard key={p.proposal_id} proposal={p} onDecide={decide} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
