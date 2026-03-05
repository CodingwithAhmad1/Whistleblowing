import { useState, useEffect, useCallback } from 'react'
import { API_CONFIG } from '@/config'
import styles from './AdminPage.module.css'

// ─── Model Usage Types ───────────────────────────────────────────────────────

interface ModelUsageStat {
  model: string
  requests_used: number
  requests_limit: number
  tokens_used: number
  tokens_limit: number
  requests_pct: number
  tokens_pct: number
  exhausted: boolean
}

interface CumulativeSummary {
  days_stored: number
  total_requests: number
  total_tokens: number
  per_model: Record<string, { requests: number; tokens: number }>
}

interface UsageSummary {
  date: string
  active_model: string
  models: ModelUsageStat[]
  cumulative: CumulativeSummary
}

// ─── ModelCard ───────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct >= 90) return '#b91c1c'
  if (pct >= 70) return '#d97706'
  return '#16a34a'
}

function ModelCard({ stat, isActive }: { stat: ModelUsageStat; isActive: boolean }) {
  return (
    <div className={styles.modelCard}>
      <div className={styles.modelCardHeader}>
        <span className={styles.modelName}>{stat.model}</span>
        {stat.exhausted && <span className={styles.badgeExhausted}>Exhausted</span>}
        {isActive && !stat.exhausted && <span className={styles.badgeActive}>Active</span>}
      </div>
      <div className={styles.barGroup}>
        <span className={styles.barLabel}>
          Requests: {stat.requests_used.toLocaleString()} / {stat.requests_limit.toLocaleString()} ({stat.requests_pct}%)
        </span>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${Math.min(stat.requests_pct, 100)}%`, backgroundColor: barColor(stat.requests_pct) }}
          />
        </div>
      </div>
      <div className={styles.barGroup}>
        <span className={styles.barLabel}>
          Tokens (est.): {stat.tokens_used.toLocaleString()} / {stat.tokens_limit.toLocaleString()} ({stat.tokens_pct}%)
        </span>
        <div className={styles.barTrack}>
          <div
            className={styles.barFill}
            style={{ width: `${Math.min(stat.tokens_pct, 100)}%`, backgroundColor: barColor(stat.tokens_pct) }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── CumulativeRow ───────────────────────────────────────────────────────────

function CumulativeRow({ cumulative }: { cumulative: CumulativeSummary }) {
  return (
    <div className={styles.cumulativeRow}>
      <span className={styles.cumulativeLabel}>
        All-time total <span className={styles.cumulativeDays}>({cumulative.days_stored} day{cumulative.days_stored !== 1 ? 's' : ''} stored)</span>
      </span>
      <span className={styles.cumulativeStat}>
        {cumulative.total_requests.toLocaleString()} requests
      </span>
      <span className={styles.cumulativeDivider}>·</span>
      <span className={styles.cumulativeStat}>
        {cumulative.total_tokens.toLocaleString()} tokens (est.)
      </span>
    </div>
  )
}

// ─── ModelUsageSection ───────────────────────────────────────────────────────

function ModelUsageSection() {
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)

  const fetchUsage = () => {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_USAGE}`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Usage fetch failed: ${r.status}`)
        return r.json()
      })
      .then((data: UsageSummary) => {
        setUsage(data)
        setUsageError(null)
      })
      .catch((e) => {
        setUsageError(e instanceof Error ? e.message : 'Failed to load usage')
      })
  }

  useEffect(() => {
    fetchUsage()
    const interval = setInterval(fetchUsage, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className={styles.usageSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Model Usage</h2>
        <p className={styles.sectionDesc}>
          Daily free-tier quota per model. The system automatically falls back to the next
          model when one is exhausted. Refreshes every 30 seconds.
        </p>
      </div>
      {usageError && <p className={styles.error}>{usageError}</p>}
      {!usageError && !usage && <p className={styles.loading}>Loading usage…</p>}
      {usage && (
        <>
          <p className={styles.usageMeta}>
            {usage.date} &mdash; Active: <strong>{usage.active_model}</strong>
          </p>
          <div className={styles.modelCards}>
            {usage.models.map((m) => (
              <ModelCard key={m.model} stat={m} isActive={m.model === usage.active_model} />
            ))}
          </div>
          <CumulativeRow cumulative={usage.cumulative} />
        </>
      )}
    </section>
  )
}

// ─── Intake Gap Configuration ─────────────────────────────────────────────────

interface GapCriteria {
  type: 'boolean_false' | 'empty_array' | 'length_threshold'
  field: string
  threshold: number | null
}

interface IntakeGap {
  id: string
  label: string
  priority: number
  active: boolean
  criteria: GapCriteria
  template: string
  template_conditional: string | null
}

const CRITERIA_TYPE_LABELS: Record<string, string> = {
  boolean_false: 'Bool flag',
  empty_array: 'Array empty',
  length_threshold: 'Min length',
}

const CRITERIA_TYPE_BADGE_CLASS: Record<string, string> = {
  boolean_false: styles.criteriaBadgeBool,
  empty_array: styles.criteriaBadgeArray,
  length_threshold: styles.criteriaBadgeLength,
}

const EMPTY_GAP: Omit<IntakeGap, 'id' | 'priority'> = {
  label: '',
  active: true,
  criteria: { type: 'boolean_false', field: '', threshold: null },
  template: '',
  template_conditional: null,
}

function GapEditForm({
  gap,
  onSave,
  onCancel,
  isNew,
}: {
  gap: Partial<IntakeGap>
  onSave: (updated: Partial<IntakeGap>) => void
  onCancel: () => void
  isNew?: boolean
}) {
  const [local, setLocal] = useState<Partial<IntakeGap>>({ ...gap })

  const set = (key: keyof IntakeGap, value: unknown) =>
    setLocal((prev) => ({ ...prev, [key]: value }))

  const setCriteria = (key: keyof GapCriteria, value: unknown) =>
    setLocal((prev) => ({
      ...prev,
      criteria: { ...(prev.criteria ?? { type: 'boolean_false', field: '', threshold: null }), [key]: value },
    }))

  const criteria = local.criteria ?? { type: 'boolean_false', field: '', threshold: null }

  return (
    <div className={styles.gapEditForm}>
      <div className={styles.gapEditRow}>
        <div className={styles.gapEditField}>
          <label className={styles.gapEditLabel}>Label</label>
          <input
            className={styles.gapEditInput}
            value={local.label ?? ''}
            onChange={(e) => set('label', e.target.value)}
            placeholder="e.g. Timeline Unclear"
          />
        </div>
        <div className={styles.gapEditField} style={{ maxWidth: 80 }}>
          <label className={styles.gapEditLabel}>Priority</label>
          <input
            className={styles.gapEditInput}
            type="number"
            min={1}
            value={local.priority ?? ''}
            onChange={(e) => set('priority', parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className={styles.gapEditField} style={{ maxWidth: 120 }}>
          <label className={styles.gapEditLabel}>Active</label>
          <label className={styles.gapActiveToggle} style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={local.active ?? true}
              onChange={(e) => set('active', e.target.checked)}
            />
            {local.active ? 'Yes' : 'No'}
          </label>
        </div>
      </div>

      <div className={styles.gapEditRow}>
        <div className={styles.gapEditField}>
          <label className={styles.gapEditLabel}>Criteria type</label>
          <select
            className={styles.gapEditSelect}
            value={criteria.type}
            onChange={(e) => setCriteria('type', e.target.value)}
          >
            <option value="boolean_false">Bool flag (field is false)</option>
            <option value="empty_array">Array empty (array has no items)</option>
            <option value="length_threshold">Min length (count &lt; threshold)</option>
          </select>
        </div>
        <div className={styles.gapEditField}>
          <label className={styles.gapEditLabel}>Layer 1 JSON field</label>
          <input
            className={styles.gapEditInput}
            value={criteria.field}
            onChange={(e) => setCriteria('field', e.target.value)}
            placeholder="e.g. timeline_clear"
          />
        </div>
        {criteria.type === 'length_threshold' && (
          <div className={styles.gapEditField} style={{ maxWidth: 100 }}>
            <label className={styles.gapEditLabel}>Threshold</label>
            <input
              className={styles.gapEditInput}
              type="number"
              min={0}
              value={criteria.threshold ?? ''}
              onChange={(e) => setCriteria('threshold', parseInt(e.target.value, 10) || 0)}
            />
          </div>
        )}
      </div>

      <div className={styles.gapEditField}>
        <label className={styles.gapEditLabel}>Template</label>
        <textarea
          className={styles.gapEditTextarea}
          value={local.template ?? ''}
          onChange={(e) => set('template', e.target.value)}
          placeholder="Standard question text (max 300 chars)"
          rows={3}
        />
        <span className={styles.helperText}>
          {(local.template ?? '').length}/300 characters
        </span>
      </div>

      <div className={styles.gapEditField}>
        <label className={styles.gapEditLabel}>Conditional template (optional)</label>
        <textarea
          className={styles.gapEditTextarea}
          value={local.template_conditional ?? ''}
          onChange={(e) => set('template_conditional', e.target.value || null)}
          placeholder="For timeline gap: use {event} placeholder. Leave empty to use main template only."
          rows={3}
        />
        <span className={styles.helperText}>
          Use <code>{'{event}'}</code> placeholder for AI-filled event reference. Only used for timeline-type gaps.
        </span>
      </div>

      <div className={styles.gapEditActions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => onSave(local)}
          style={{ marginTop: 0 }}
        >
          {isNew ? 'Add gap' : 'Save gap'}
        </button>
        <button type="button" className={styles.editBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function GapConfigSection() {
  const [gaps, setGaps] = useState<IntakeGap[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const fetchGaps = useCallback(() => {
    setLoading(true)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_INTAKE_GAPS}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setGaps(data.gaps ?? [])
        setLoadError(null)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchGaps() }, [fetchGaps])

  const saveGaps = (nextGaps: IntakeGap[]) => {
    setSaving(true)
    setSaveStatus(null)
    setSaveError(null)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_INTAKE_GAPS}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gaps: nextGaps }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status >= 500 ? 'Server error' : `Request failed: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setGaps(data.gaps ?? nextGaps)
        // Invalidate useIntakeAnalysis cache so subsequent report submissions
        // pick up the new gap templates.
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('whistleblow_settingsModified', Date.now().toString())
        }
        setSaveStatus('Saved.')
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : 'Failed to save'))
      .finally(() => setSaving(false))
  }

  const moveGap = (idx: number, dir: -1 | 1) => {
    const next = [...gaps]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    // Capture both originals before any mutation
    const a = next[idx]
    const b = next[target]
    // Swap array positions while exchanging their priority values so the backend
    // sort order stays consistent with what the user sees.
    next[idx] = { ...b, priority: a.priority }
    next[target] = { ...a, priority: b.priority }
    setGaps(next)
    setSaveStatus(null)
  }

  const handleEditSave = (id: string, updated: Partial<IntakeGap>) => {
    const next = gaps.map((g) => (g.id === id ? { ...g, ...updated, id } : g))
    setGaps(next)
    setExpandedId(null)
    setSaveStatus(null)
  }

  const handleToggleActive = (id: string) => {
    setGaps((prev) => prev.map((g) => g.id === id ? { ...g, active: !g.active } : g))
    setSaveStatus(null)
  }

  const handleDelete = (id: string) => {
    if (pendingDeleteId === id) {
      setGaps((prev) => prev.filter((g) => g.id !== id))
      setPendingDeleteId(null)
      setSaveStatus(null)
    } else {
      setPendingDeleteId(id)
    }
  }

  const handleAddSave = (newGap: Partial<IntakeGap>) => {
    const maxPriority = Math.max(0, ...gaps.map((g) => g.priority))
    const gap: IntakeGap = {
      id: `gap_${Date.now()}`,
      label: newGap.label ?? 'New Gap',
      priority: maxPriority + 1,
      active: newGap.active ?? true,
      criteria: newGap.criteria ?? { type: 'boolean_false', field: '', threshold: null },
      template: newGap.template ?? '',
      template_conditional: newGap.template_conditional ?? null,
    }
    setGaps((prev) => [...prev, gap])
    setShowAddForm(false)
    setSaveStatus(null)
  }

  const handleReset = () => {
    setIsResetting(true)
    setResetError(null)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_INTAKE_GAPS_RESET}`, { method: 'POST' })
      .then((r) => {
        if (!r.ok) throw new Error(`Reset failed: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setGaps(data.gaps ?? [])
        setShowResetModal(false)
        setSaveStatus('Reset to defaults.')
        setSaveError(null)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('whistleblow_settingsModified', Date.now().toString())
        }
      })
      .catch((e) => setResetError(e instanceof Error ? e.message : 'Reset failed'))
      .finally(() => setIsResetting(false))
  }

  if (loading) return <p className={styles.loading}>Loading gap configuration…</p>
  if (loadError) return <p className={styles.error}>{loadError} <button className={styles.editBtn} onClick={fetchGaps}>Retry</button></p>

  return (
    <div>
      {showResetModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <div className={styles.modal}>
            <h3 id="reset-modal-title" className={styles.modalTitle}>Reset gap analysis settings?</h3>
            <p className={styles.modalText}>
              Are you sure you want to reset gap analysis settings to default? This will overwrite your current changes.
            </p>
            {resetError && <p className={styles.error}>{resetError}</p>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleReset}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting…' : 'Confirm'}
              </button>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => { setShowResetModal(false); setResetError(null) }}
                disabled={isResetting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.gapSectionTopBar}>
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => setShowResetModal(true)}
        >
          Reset to defaults
        </button>
      </div>

      <div className={styles.gapList}>
        {gaps.map((gap, idx) => {
          const isExpanded = expandedId === gap.id
          const badgeClass = CRITERIA_TYPE_BADGE_CLASS[gap.criteria.type] ?? ''
          const isPendingDelete = pendingDeleteId === gap.id

          return (
            <div key={gap.id} className={styles.gapCard}>
              <div className={styles.gapCardHeader}>
                <span className={styles.gapPriority}>{gap.priority}</span>

                <span className={styles.gapLabel}>{gap.label || <em>Untitled gap</em>}</span>

                <span className={`${styles.criteriaBadge} ${badgeClass}`}>
                  {CRITERIA_TYPE_LABELS[gap.criteria.type] ?? gap.criteria.type}
                </span>

                <label className={styles.gapActiveToggle}>
                  <input
                    type="checkbox"
                    checked={gap.active}
                    onChange={() => handleToggleActive(gap.id)}
                  />
                  {gap.active ? 'Active' : 'Off'}
                </label>

                <div className={styles.priorityBtns}>
                  <button
                    className={styles.priorityBtn}
                    onClick={() => moveGap(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Move up"
                    title="Move up"
                  >▲</button>
                  <button
                    className={styles.priorityBtn}
                    onClick={() => moveGap(idx, 1)}
                    disabled={idx === gaps.length - 1}
                    aria-label="Move down"
                    title="Move down"
                  >▼</button>
                </div>

                <button
                  className={styles.editBtn}
                  onClick={() => setExpandedId(isExpanded ? null : gap.id)}
                >
                  {isExpanded ? 'Close' : 'Edit'}
                </button>

                {isPendingDelete ? (
                  <>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(gap.id)}>
                      Confirm delete
                    </button>
                    <button className={styles.editBtn} onClick={() => setPendingDeleteId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className={styles.deleteBtn} onClick={() => handleDelete(gap.id)}>
                    Delete
                  </button>
                )}
              </div>

              {!isExpanded && (
                <div className={styles.templatePreview}>
                  <span className={styles.templatePreviewText}>
                    {gap.template || <em className={styles.templateEmpty}>No template set</em>}
                  </span>
                  {gap.template_conditional && (
                    <span className={styles.templateConditionalPreview}>
                      Conditional: {gap.template_conditional}
                    </span>
                  )}
                </div>
              )}

              {isExpanded && (
                <GapEditForm
                  gap={gap}
                  onSave={(updated) => handleEditSave(gap.id, updated)}
                  onCancel={() => setExpandedId(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      {showAddForm ? (
        <div className={styles.addGapSection}>
          <p className={styles.addGapTitle}>Add new gap</p>
          <GapEditForm
            gap={{ ...EMPTY_GAP, priority: Math.max(0, ...gaps.map((g) => g.priority)) + 1 }}
            onSave={handleAddSave}
            onCancel={() => setShowAddForm(false)}
            isNew
          />
        </div>
      ) : (
        <div style={{ marginTop: 'var(--space-12)' }}>
          <button className={styles.addGapBtn} onClick={() => setShowAddForm(true)}>
            + Add gap
          </button>
        </div>
      )}

      <div className={styles.gapSaveRow}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => saveGaps(gaps)}
          disabled={saving}
          style={{ marginTop: 0 }}
        >
          {saving ? 'Saving…' : 'Save gap changes'}
        </button>
        {saveStatus && <span className={styles.gapSaveStatus}>{saveStatus}</span>}
        {saveError && <span className={styles.gapSaveError}>{saveError}</span>}
      </div>
    </div>
  )
}

export function AdminPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Settings</h1>
      <p className={styles.subtitle}>
        Configure intake gap types and monitor AI model quota usage.
      </p>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Gap Configuration</h2>
          <p className={styles.sectionDesc}>
            Define the gaps evaluated after Q1. The system selects the top 2 active gaps
            (by priority) and generates follow-up questions using the templates below.
            Changes are staged locally — click <strong>Save gap changes</strong> to persist.
          </p>
        </div>
        <GapConfigSection />
      </section>

      <hr className={styles.divider} />
      <ModelUsageSection />
    </div>
  )
}
