import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { API_CONFIG } from '@/config'
import styles from './AdminPage.module.css'

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

const LAYER1_FIELDS: { value: string; label: string }[] = [
  { value: 'summary', label: 'Summary (string)' },
  { value: 'dates_mentioned', label: 'Dates mentioned (array)' },
  { value: 'people_mentioned', label: 'People mentioned (array)' },
  { value: 'locations_mentioned', label: 'Locations mentioned (array)' },
  { value: 'specific_examples_present', label: 'Specific examples present (bool)' },
  { value: 'evidence_described', label: 'Evidence described (bool)' },
  { value: 'timeline_clear', label: 'Timeline clear (bool)' },
  { value: 'witnesses_mentioned', label: 'Witnesses mentioned (bool)' },
  { value: 'prior_reporting_mentioned', label: 'Prior reporting mentioned (bool)' },
  { value: 'impact_described', label: 'Impact described (bool)' },
  { value: 'retaliation_mentioned', label: 'Retaliation mentioned (bool)' },
  { value: 'allegation_type', label: 'Allegation type (array)' },
  { value: 'length_character_count', label: 'Character count (number)' },
]

const CRITERIA_TYPES: { value: GapCriteria['type']; label: string }[] = [
  { value: 'boolean_false', label: 'True/False Check' },
  { value: 'empty_array', label: 'List Check' },
  { value: 'length_threshold', label: 'Minimum Length' },
]

/** Non-blocking hints to encourage investigator-grade, non-vague Q2 text. */
function templateEditorWarnings(template: string | undefined): string[] {
  const t = (template ?? '').trim()
  const out: string[] = []
  if (t.length > 0 && t.length < 50) {
    out.push('Short templates often get vague answers. Ask for 2–3 concrete items (e.g. who, when, channel, outcome).')
  }
  if (t.length > 0 && !t.includes('?')) {
    out.push('Consider ending with a clear question so reporters know how to answer.')
  }
  const looksConcrete = /(who|whom|when|where|date|time|name|list|email|outcome|channel|reference|describe|incident|verify)/i
  if (t.length > 80 && !looksConcrete.test(t)) {
    out.push('This may read as generic. Name what to include (names, dates, who was told, what happened next).')
  }
  return out
}

function GapEditForm({
  gap,
  onSave,
  onCancel,
}: {
  gap: Partial<IntakeGap>
  onSave: (updated: Partial<IntakeGap>) => void
  onCancel: () => void
}) {
  const [local, setLocal] = useState<Partial<IntakeGap>>({ ...gap })

  const set = (key: keyof IntakeGap, value: unknown) =>
    setLocal((prev) => ({ ...prev, [key]: value }))

  const criteria = local.criteria ?? { type: 'boolean_false', field: '', threshold: null }

  const twarn = templateEditorWarnings(local.template)

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
      </div>

      <div className={styles.gapEditRow}>
        <div className={styles.gapEditField}>
          <label className={styles.gapEditLabel}>Criteria type</label>
          <select
            className={styles.gapEditInput}
            value={criteria.type}
            onChange={(e) =>
              set('criteria', {
                ...criteria,
                type: e.target.value as GapCriteria['type'],
                threshold: e.target.value === 'length_threshold' ? (criteria.threshold ?? 300) : null,
              })
            }
          >
            {CRITERIA_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.gapEditField}>
          <label className={styles.gapEditLabel}>Target field</label>
          <select
            className={styles.gapEditInput}
            value={criteria.field}
            onChange={(e) => set('criteria', { ...criteria, field: e.target.value })}
          >
            <option value="">— select field —</option>
            {LAYER1_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        {criteria.type === 'length_threshold' && (
          <div className={styles.gapEditField} style={{ maxWidth: 120 }}>
            <label className={styles.gapEditLabel}>Min characters</label>
            <input
              type="number"
              className={styles.gapEditInput}
              min={1}
              value={criteria.threshold ?? 0}
              onChange={(e) =>
                set('criteria', { ...criteria, threshold: Math.max(1, parseInt(e.target.value, 10) || 0) })
              }
            />
          </div>
        )}
      </div>

      <div className={styles.gapEditField}>
        <label className={styles.gapEditLabel}>Template</label>
        <p className={styles.templateGuidance}>
          This text is the exact follow-up shown to the reporter. Prefer one question that
          requests recordable details investigators need (who, when, how raised, outcome).
          You can tell reporters to answer &ldquo;already provided&rdquo; if the narrative
          already covered it — that reduces repeat answers without hiding gaps from reviewers.
        </p>
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
        {twarn.length > 0 && (
          <ul className={styles.templateWarningList}>
            {twarn.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.gapEditActions}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={() => onSave(local)}
          style={{ marginTop: 0 }}
        >
          Save
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  // ── Pointer-based vertical drag-to-reorder ──
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const cardRectsRef = useRef<DOMRect[]>([])

  const startDrag = (idx: number, e: ReactPointerEvent) => {
    e.preventDefault()
    const listEl = listRef.current
    if (!listEl) return
    const cards = Array.from(listEl.children) as HTMLElement[]
    cardRectsRef.current = cards.map((c) => c.getBoundingClientRect())
    setDragIdx(idx)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: ReactPointerEvent) => {
    if (dragIdx === null) return
    const rects = cardRectsRef.current
    if (!rects.length) return
    const currentY = e.clientY
    // Find which card the pointer has crossed the midpoint of
    let overIdx: number | null = null
    for (let i = 0; i < rects.length; i++) {
      if (i === dragIdx) continue
      const mid = rects[i].top + rects[i].height / 2
      // Only trigger when pointer crosses past the midpoint
      if (i < dragIdx && currentY < mid) { overIdx = i; break }
      if (i > dragIdx && currentY > mid) { overIdx = i }
    }
    setDragOverIdx(overIdx)
  }

  const endDrag = () => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const next = [...gaps]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(dragOverIdx, 0, moved)
      const reordered = next.map((g, i) => ({ ...g, priority: i + 1 }))
      setGaps(reordered)
      saveGaps(reordered, true)
    }
    setDragIdx(null)
    setDragOverIdx(null)
    cardRectsRef.current = []
  }

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

  const saveGaps = (nextGaps: IntakeGap[], silent = false) => {
    if (!silent) setSaving(true)
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
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('whistleblow_settingsModified', Date.now().toString())
        }
        if (!silent) {
          setSaveStatus('Saved.')
          setTimeout(() => setSaveStatus(null), 2000)
        }
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : 'Failed to save'))
      .finally(() => { if (!silent) setSaving(false) })
  }

  const handleEditSave = (id: string, updated: Partial<IntakeGap>) => {
    const next = gaps.map((g) => (g.id === id ? { ...g, ...updated, active: true, id } : g))
    setGaps(next)
    setExpandedId(null)
    saveGaps(next)
  }

  const handleDelete = (id: string) => {
    if (pendingDeleteId === id) {
      const next = gaps.filter((g) => g.id !== id)
      setGaps(next)
      setPendingDeleteId(null)
      setSaveStatus(null)
      saveGaps(next)
    } else {
      setPendingDeleteId(id)
    }
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
        setSaveStatus(null)
        setSaveError(null)
        setExpandedId(null)
        setPendingDeleteId(null)
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
                className={styles.editBtn}
                onClick={() => { setShowResetModal(false); setResetError(null) }}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleReset}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting\u2026' : 'Confirm'}
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

      {saving && <span className={styles.gapAutoSaveStatus}>Saving...</span>}
      {saveStatus && <span className={styles.gapAutoSaveStatus}>{saveStatus}</span>}
      {saveError && <span className={styles.error}>{saveError}</span>}

      <div
        className={styles.gapList}
        ref={listRef}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        {gaps.map((gap, idx) => {
          const isExpanded = expandedId === gap.id
          const badgeClass = CRITERIA_TYPE_BADGE_CLASS[gap.criteria.type] ?? ''
          const isPendingDelete = pendingDeleteId === gap.id
          const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
          const dragDirection = isDragOver ? (dragIdx < idx ? 'down' : 'up') : null

          return (
            <div
              key={gap.id}
              className={`${styles.gapCard}${dragDirection === 'down' ? ` ${styles.gapCardDragOverBottom}` : ''}${dragDirection === 'up' ? ` ${styles.gapCardDragOverTop}` : ''}`}
            >
              <div className={styles.gapCardHeader}>
                <span
                  className={styles.dragHandle}
                  onPointerDown={(e) => startDrag(idx, e)}
                  title="Drag to reorder"
                >
                  &#x2630;
                </span>
                <span className={styles.gapPriority}>{gap.priority}</span>

                <span className={styles.gapLabel}>{gap.label || <em>Untitled gap</em>}</span>

                <span className={`${styles.criteriaBadge} ${badgeClass}`}>
                  {CRITERIA_TYPE_LABELS[gap.criteria.type] ?? gap.criteria.type}
                </span>

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
    </div>
  )
}

// ─── Gemini Status Section ───────────────────────────────────────────────────

function GeminiStatusSection() {
  const [status, setStatus] = useState<'untested' | 'success' | 'error'>('untested')
  const [testing, setTesting] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleTest = () => {
    setTesting(true)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_GEMINI_TEST}`, { method: 'POST' })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`)
        return r.json()
      })
      .then((data: { success: boolean; model: string | null; error: string | null }) => {
        if (data.success) {
          setStatus('success')
          setModel(data.model)
          setErrorMsg(null)
        } else {
          setStatus('error')
          setModel(null)
          setErrorMsg(data.error || 'Unknown error')
        }
      })
      .catch((e) => {
        setStatus('error')
        setModel(null)
        setErrorMsg(e instanceof Error ? e.message : 'Network error')
      })
      .finally(() => setTesting(false))
  }

  const iconClass =
    status === 'success'
      ? styles.geminiIconSuccess
      : status === 'error'
        ? styles.geminiIconError
        : styles.geminiIconUntested

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Gemini Activated</h2>
        <p className={styles.sectionDesc}>Test the live connection to the Gemini API.</p>
      </div>
      <div className={styles.geminiStatusCard}>
        <span className={`${styles.geminiIcon} ${iconClass}`}>
          {status === 'untested' && '\u2014'}
          {status === 'success' && '\u2713'}
          {status === 'error' && '\u2717'}
        </span>
        <div className={styles.geminiInfo}>
          {status === 'untested' && <span>Not tested yet</span>}
          {status === 'success' && <span>Connected &mdash; <strong>{model}</strong></span>}
          {status === 'error' && <span className={styles.geminiErrorText}>{errorMsg}</span>}
        </div>
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? 'Testing\u2026' : 'Test'}
        </button>
      </div>
    </section>
  )
}

// ─── AI Pipeline Diagnostics ────────────────────────────────────────────────

interface TestFixture {
  id: string
  label: string
  description: string
  form_data: Record<string, string>
}

interface StepResult {
  status: 'pass' | 'fail' | 'skip'
  result: unknown
  time_ms: number
  error: string | null
  violations?: string[]
}

interface TestResult {
  fixture_id: string
  fixture_label: string
  timestamp: string
  overall_status: 'pass' | 'fail' | 'partial'
  total_time_ms: number
  steps: {
    intake_layer1_extraction: StepResult
    intake_layer2_gaps: StepResult
    intake_layer3_questions: StepResult
    constructed_sentence: StepResult
    rag_retrieval: StepResult
  }
}

interface TestRunResponse {
  overall_status: string
  results: TestResult[]
}

const STEP_LABELS: Record<string, string> = {
  intake_layer1_extraction: 'Step 1: Intake Extraction (Layer 1)',
  intake_layer2_gaps: 'Step 2: Gap Analysis (Layer 2)',
  intake_layer3_questions: 'Step 3: Question Generation (Layer 3)',
  constructed_sentence: 'Step 4: Constructed Sentence',
  rag_retrieval: 'Step 5: RAG Retrieval + Reranking',
}

function StepResultCard({ stepKey, step }: { stepKey: string; step: StepResult }) {
  const [expanded, setExpanded] = useState(false)
  const icon = step.status === 'pass' ? '\u2713' : step.status === 'fail' ? '\u2717' : '\u2014'
  const colorClass = step.status === 'pass'
    ? styles.diagStepPass
    : step.status === 'fail'
      ? styles.diagStepFail
      : styles.diagStepSkip

  return (
    <div className={styles.diagStepCard}>
      <div className={styles.diagStepHeader} onClick={() => setExpanded(!expanded)}>
        <span className={colorClass}>{icon}</span>
        <span className={styles.diagStepLabel}>{STEP_LABELS[stepKey] ?? stepKey}</span>
        <span className={styles.diagStepTime}>{step.time_ms}ms</span>
        <span className={styles.diagExpandIcon}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expanded && (
        <div className={styles.diagStepDetail}>
          {step.error && <p className={styles.diagError}>Error: {step.error}</p>}
          {step.violations && step.violations.length > 0 && (
            <ul className={styles.diagViolations}>
              {step.violations.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          )}
          {step.result != null && (
            <pre className={styles.diagPre}>
              {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
            </pre>
          )}
          {!step.error && step.result == null && !step.violations?.length && (
            <p className={styles.diagMuted}>No output</p>
          )}
        </div>
      )}
    </div>
  )
}

function DiagnosticsSection() {
  const [fixtures, setFixtures] = useState<TestFixture[]>([])
  const [selectedFixture, setSelectedFixture] = useState<string>('__all__')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TestResult[] | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [history, setHistory] = useState<TestResult[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_TEST_FIXTURES}`)
      .then((r) => r.json())
      .then((data) => setFixtures(data.fixtures ?? []))
      .catch(() => {})
  }, [])

  const fetchHistory = useCallback(() => {
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_TEST_HISTORY}`)
      .then((r) => r.json())
      .then((data) => setHistory((data.history ?? []).reverse()))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  useEffect(() => () => { stopTimer(); abortRef.current?.abort() }, [])

  const handleRun = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRunning(true)
    setResults(null)
    setRunError(null)
    setElapsedMs(0)

    const start = Date.now()
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - start), 100)

    const body = selectedFixture === '__all__' ? {} : { fixture_id: selectedFixture }

    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_TEST_PIPELINE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Test failed: ${r.status}`)
        return r.json()
      })
      .then((data: TestRunResponse) => {
        setResults(data.results)
        fetchHistory()
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setRunError('Test cancelled.')
        } else {
          setRunError(e instanceof Error ? e.message : 'Test run failed')
        }
      })
      .finally(() => {
        stopTimer()
        setRunning(false)
      })
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleClearHistory = () => {
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_TEST_HISTORY}`, { method: 'DELETE' })
      .then(() => setHistory([]))
      .catch(() => {})
  }

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>AI Pipeline Diagnostics</h2>
        <p className={styles.sectionDesc}>
          Run an end-to-end test of the 5-step AI pipeline: intake extraction, gap analysis, question generation, constructed sentence, and RAG retrieval.
        </p>
      </div>

      <div className={styles.diagControls}>
        <select
          className={styles.gapEditSelect}
          value={selectedFixture}
          onChange={(e) => setSelectedFixture(e.target.value)}
          disabled={running}
        >
          <option value="__all__">Run all fixtures</option>
          {fixtures.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleRun}
          disabled={running}
          style={{ marginTop: 0 }}
        >
          {running ? 'Running\u2026' : 'Run Test'}
        </button>
      </div>

      {runError && <p className={styles.error}>{runError}</p>}

      {running && (
        <div className={styles.diagRunning}>
          <p className={styles.loadingText}>
            Running AI pipeline test… <span className={styles.diagTimer}>{(elapsedMs / 1000).toFixed(1)}s</span>
          </p>
          <button
            type="button"
            className={styles.diagCancelBtn}
            onClick={handleCancel}
            aria-label="Cancel test"
            title="Cancel test"
          >
            &times;
          </button>
        </div>
      )}

      {results && results.map((result) => (
        <div key={result.fixture_id} className={styles.diagResultCard}>
          <div className={styles.diagResultHeader}>
            <span className={
              result.overall_status === 'pass' ? styles.diagStepPass
                : result.overall_status === 'fail' ? styles.diagStepFail
                  : styles.diagStepSkip
            }>
              {result.overall_status === 'pass' ? '\u2713' : result.overall_status === 'fail' ? '\u2717' : '\u2014'}
            </span>
            <strong>{result.fixture_label}</strong>
            <span className={styles.diagStepTime}>{result.total_time_ms}ms total</span>
          </div>
          {Object.entries(result.steps).map(([key, step]) => (
            <StepResultCard key={key} stepKey={key} step={step} />
          ))}
        </div>
      ))}

      <div className={styles.diagHistoryHeader}>
        <button
          type="button"
          className={styles.editBtn}
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? 'Hide history' : `Show history (${history.length})`}
        </button>
        {showHistory && history.length > 0 && (
          <button type="button" className={styles.deleteBtn} onClick={handleClearHistory}>
            Clear history
          </button>
        )}
      </div>

      {showHistory && (
        <div className={styles.diagHistoryList}>
          {history.length === 0 && <p className={styles.diagMuted}>No test history yet.</p>}
          {history.map((h, i) => (
            <div key={i} className={styles.diagHistoryItem}>
              <span className={
                h.overall_status === 'pass' ? styles.diagStepPass : styles.diagStepFail
              }>
                {h.overall_status === 'pass' ? '\u2713' : '\u2717'}
              </span>
              <span>{h.fixture_label}</span>
              <span className={styles.diagStepTime}>{h.total_time_ms}ms</span>
              <span className={styles.diagMuted}>
                {new Date(h.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function AdminPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Settings</h1>
      <p className={styles.subtitle}>
        Configure intake gap types and monitor AI pipeline health.
      </p>

      <GeminiStatusSection />

      <hr className={styles.divider} />
      <DiagnosticsSection />

      <hr className={styles.divider} />

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Gap Configuration</h2>
          <p className={styles.sectionDesc}>
            Define the gaps evaluated after the combined narrative (what happened, sequence, evidence). The
            backend walks active gaps in priority order and may surface <strong>up to two</strong> template
            follow-ups per intake run — never more. Templates work best when they ask for specific,
            investigation-ready details rather than open-ended restatement. Edits, deletes, and drag-reorder
            save to the backend immediately via the intake-gaps API.
          </p>
        </div>
        <GapConfigSection />
      </section>

    </div>
  )
}
