import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API_CONFIG } from '@/config'
import styles from './AnalysisPage.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Layer1Extraction {
  summary: string
  dates_mentioned: string[]
  people_mentioned: string[]
  locations_mentioned: string[]
  specific_examples_present: boolean
  evidence_described: boolean
  timeline_clear: boolean
  allegation_type: string[]
  length_character_count: number
}

interface FollowUpQuestion {
  gap_id: string
  question_text: string
}

interface LastAnalysisResult {
  timestamp: string
  extraction: Layer1Extraction
  gaps: string[]
  follow_up_questions: FollowUpQuestion[]
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function criteriaDescription(criteria: GapCriteria): string {
  if (criteria.type === 'boolean_false') return `"${criteria.field}" is false`
  if (criteria.type === 'empty_array') return `"${criteria.field}" is empty`
  if (criteria.type === 'length_threshold') return `"${criteria.field}" < ${criteria.threshold} chars`
  return criteria.type
}

function listOrNone(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'None'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BoolBadge({ value, label }: { value: boolean; label: string }) {
  return (
    <span className={value ? styles.badgeTrue : styles.badgeFalse}>
      {label}: {value ? 'Yes' : 'No'}
    </span>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  )
}

function Layer1Card({ extraction }: { extraction: Layer1Extraction }) {
  return (
    <Card title="Layer 1 — Narrative Extraction">
      {extraction.summary && (
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Summary</span>
          <p className={styles.fieldValue}>{extraction.summary}</p>
        </div>
      )}
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Character count</span>
        <span className={styles.fieldValue}>{extraction.length_character_count.toLocaleString()}</span>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Boolean flags</span>
        <div className={styles.badgeRow}>
          <BoolBadge value={extraction.timeline_clear} label="Timeline clear" />
          <BoolBadge value={extraction.specific_examples_present} label="Specific examples" />
          <BoolBadge value={extraction.evidence_described} label="Evidence described" />
        </div>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Dates mentioned</span>
        <span className={styles.fieldValue}>{listOrNone(extraction.dates_mentioned)}</span>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>People mentioned</span>
        <span className={styles.fieldValue}>{listOrNone(extraction.people_mentioned)}</span>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Locations mentioned</span>
        <span className={styles.fieldValue}>{listOrNone(extraction.locations_mentioned)}</span>
      </div>
      <div className={styles.fieldRow}>
        <span className={styles.fieldLabel}>Allegation type</span>
        <span className={styles.fieldValue}>{listOrNone(extraction.allegation_type)}</span>
      </div>
    </Card>
  )
}

function Layer2Card({ gapIds, gapMap }: { gapIds: string[]; gapMap: Map<string, IntakeGap> }) {
  return (
    <Card title="Layer 2 — Gap Analysis">
      {gapIds.length === 0 ? (
        <p className={styles.emptyNote}>No gaps identified — narrative was sufficiently complete.</p>
      ) : (
        <ul className={styles.gapResultList}>
          {gapIds.map((id) => {
            const gap = gapMap.get(id)
            return (
              <li key={id} className={styles.gapResultItem}>
                <span className={styles.gapResultLabel}>{gap?.label ?? id}</span>
                {gap && (
                  <span className={styles.gapResultCriteria}>
                    Triggered because: {criteriaDescription(gap.criteria)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Layer3Card({ questions, gapMap }: { questions: FollowUpQuestion[]; gapMap: Map<string, IntakeGap> }) {
  return (
    <Card title="Layer 3 — Follow-up Questions Selected">
      {questions.length === 0 ? (
        <p className={styles.emptyNote}>No follow-up questions generated.</p>
      ) : (
        <ul className={styles.questionList}>
          {questions.map((q) => {
            const gap = gapMap.get(q.gap_id)
            return (
              <li key={q.gap_id} className={styles.questionItem}>
                <span className={styles.questionGapTag}>{gap?.label ?? q.gap_id}</span>
                <p className={styles.questionText}>{q.question_text}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function GapConfigCard({ gap }: { gap: IntakeGap }) {
  const badgeClass = CRITERIA_TYPE_BADGE_CLASS[gap.criteria.type] ?? ''
  return (
    <div className={styles.gapCard}>
      <div className={styles.gapCardHeader}>
        <span className={styles.gapPriority}>{gap.priority}</span>
        <span className={styles.gapLabel}>{gap.label}</span>
        <span className={`${styles.criteriaBadge} ${badgeClass}`}>
          {CRITERIA_TYPE_LABELS[gap.criteria.type] ?? gap.criteria.type}
        </span>
        <span className={gap.active ? styles.badgeActive : styles.badgeInactive}>
          {gap.active ? 'Active' : 'Off'}
        </span>
      </div>
      <div className={styles.gapCardBody}>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Criteria</span>
          <span className={styles.fieldValue}>{criteriaDescription(gap.criteria)}</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Template</span>
          <p className={styles.fieldValue}>{gap.template}</p>
        </div>
        {gap.template_conditional && (
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Conditional template</span>
            <p className={styles.fieldValue}>{gap.template_conditional}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<LastAnalysisResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [gaps, setGaps] = useState<IntakeGap[]>([])
  const [gapsLoading, setGapsLoading] = useState(true)
  const [gapsError, setGapsError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(() => {
    setAnalysisLoading(true)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_LAST_ANALYSIS}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setAnalysisResult(data.result ?? null)
        setAnalysisError(null)
      })
      .catch((e) => setAnalysisError(e instanceof Error ? e.message : 'Failed to load analysis'))
      .finally(() => setAnalysisLoading(false))
  }, [])

  const fetchGaps = useCallback(() => {
    setGapsLoading(true)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ADMIN_INTAKE_GAPS}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setGaps(data.gaps ?? [])
        setGapsError(null)
      })
      .catch((e) => setGapsError(e instanceof Error ? e.message : 'Failed to load gaps'))
      .finally(() => setGapsLoading(false))
  }, [])

  useEffect(() => {
    fetchAnalysis()
    fetchGaps()
  }, [fetchAnalysis, fetchGaps])

  const gapMap = new Map(gaps.map((g) => [g.id, g]))

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Analysis</h1>
      <p className={styles.subtitle}>
        Internal AI evaluation of the most recent Q1 submission — extraction, gap detection, and follow-up question selection.
      </p>

      {/* ── Last Analysis Result ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Last Analysis Result</h2>
          <p className={styles.sectionDesc}>
            Populated each time a user submits a Q1 narrative. Shows the full 3-layer pipeline output.
          </p>
        </div>

        {analysisLoading && <p className={styles.loading}>Loading…</p>}
        {analysisError && (
          <p className={styles.error}>
            {analysisError}{' '}
            <button className={styles.retryBtn} onClick={fetchAnalysis}>Retry</button>
          </p>
        )}

        {!analysisLoading && !analysisError && !analysisResult && (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>No analysis run yet.</p>
            <p className={styles.emptyStateHint}>Submit a Q1 narrative on the Home page to see results here.</p>
          </div>
        )}

        {!analysisLoading && !analysisError && analysisResult && (
          <>
            <p className={styles.timestamp}>
              Last analyzed: <strong>{formatTimestamp(analysisResult.timestamp)}</strong>
            </p>
            <div className={styles.cardStack}>
              <Layer1Card extraction={analysisResult.extraction} />
              <Layer2Card gapIds={analysisResult.gaps} gapMap={gapMap} />
              <Layer3Card questions={analysisResult.follow_up_questions} gapMap={gapMap} />
            </div>
          </>
        )}
      </section>

      <hr className={styles.divider} />

      {/* ── Current Gap Configuration ────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Current Gap Configuration</h2>
          <p className={styles.sectionDesc}>
            Read-only view of active gap definitions. To add, edit, or reorder gaps, go to the{' '}
            <Link to="/admin" className={styles.adminLink}>Admin panel</Link>.
          </p>
        </div>

        {gapsLoading && <p className={styles.loading}>Loading gaps…</p>}
        {gapsError && (
          <p className={styles.error}>
            {gapsError}{' '}
            <button className={styles.retryBtn} onClick={fetchGaps}>Retry</button>
          </p>
        )}
        {!gapsLoading && !gapsError && gaps.length === 0 && (
          <p className={styles.emptyNote}>No gaps configured.</p>
        )}
        {!gapsLoading && !gapsError && gaps.length > 0 && (
          <div className={styles.gapList}>
            {gaps.map((gap) => <GapConfigCard key={gap.id} gap={gap} />)}
          </div>
        )}
      </section>
    </div>
  )
}
