import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API_CONFIG } from '@/config'
import { LAST_INTAKE_ANALYSIS_STORAGE_KEY } from '@/hooks/useIntakeAnalysis'
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
  witnesses_mentioned?: boolean
  prior_reporting_mentioned?: boolean
  impact_described?: boolean
  retaliation_mentioned?: boolean
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
  used_defaults?: boolean
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
  template_conditional?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRITERIA_TYPE_LABELS: Record<string, string> = {
  boolean_false: 'True/False Check',
  empty_array: 'List Check',
  length_threshold: 'Minimum Length',
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  timeline_clear: 'Timeline clarity',
  specific_examples_present: 'Specific examples',
  evidence_described: 'Evidence described',
  witnesses_mentioned: 'Witnesses mentioned',
  prior_reporting_mentioned: 'Prior reporting mentioned',
  impact_described: 'Impact described',
  retaliation_mentioned: 'Retaliation mentioned',
  dates_mentioned: 'Dates mentioned',
  people_mentioned: 'People mentioned',
  locations_mentioned: 'Locations mentioned',
  length_character_count: 'Narrative length',
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
  const fieldLabel = FIELD_DESCRIPTIONS[criteria.field] ?? criteria.field
  if (criteria.type === 'boolean_false') return `${fieldLabel}: Not present`
  if (criteria.type === 'empty_array') return `${fieldLabel}: None provided`
  if (criteria.type === 'length_threshold') return `${fieldLabel}: Below ${criteria.threshold} characters`
  return criteria.type
}

function listOrNone(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'None'
}

function normalizeExtraction(raw: unknown): Layer1Extraction | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const asStrArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const asBool = (v: unknown) => Boolean(v)
  return {
    summary: String(e.summary ?? ''),
    dates_mentioned: asStrArr(e.dates_mentioned),
    people_mentioned: asStrArr(e.people_mentioned),
    locations_mentioned: asStrArr(e.locations_mentioned),
    specific_examples_present: asBool(e.specific_examples_present),
    evidence_described: asBool(e.evidence_described),
    timeline_clear: asBool(e.timeline_clear),
    witnesses_mentioned: e.witnesses_mentioned !== undefined ? asBool(e.witnesses_mentioned) : undefined,
    prior_reporting_mentioned:
      e.prior_reporting_mentioned !== undefined ? asBool(e.prior_reporting_mentioned) : undefined,
    impact_described: e.impact_described !== undefined ? asBool(e.impact_described) : undefined,
    retaliation_mentioned: e.retaliation_mentioned !== undefined ? asBool(e.retaliation_mentioned) : undefined,
    allegation_type: asStrArr(e.allegation_type),
    length_character_count: typeof e.length_character_count === 'number' ? e.length_character_count : 0,
  }
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
          {extraction.witnesses_mentioned !== undefined && (
            <BoolBadge value={extraction.witnesses_mentioned} label="Witnesses mentioned" />
          )}
          {extraction.prior_reporting_mentioned !== undefined && (
            <BoolBadge value={extraction.prior_reporting_mentioned} label="Prior reporting" />
          )}
          {extraction.impact_described !== undefined && (
            <BoolBadge value={extraction.impact_described} label="Impact described" />
          )}
          {extraction.retaliation_mentioned !== undefined && (
            <BoolBadge value={extraction.retaliation_mentioned} label="Retaliation mentioned" />
          )}
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

function formatGapId(id: string): string {
  // Turn slug IDs like "timeline_unclear" or "gap_1772801924087" into readable labels
  return id
    .replace(/^gap_\d+$/, 'Unknown Gap')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
                <span className={styles.gapResultLabel}>{gap?.label ?? formatGapId(id)}</span>
                {gap ? (
                  <span className={styles.gapResultCriteria}>
                    Triggered because: {criteriaDescription(gap.criteria)}
                  </span>
                ) : (
                  <span className={styles.gapResultCriteria}>
                    Gap config no longer exists — re-run analysis for updated results.
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
                <span className={styles.questionGapTag}>{gap?.label ?? formatGapId(q.gap_id)}</span>
                <p className={styles.questionText}>{q.question_text}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function GapStatusBadge({ gap, extraction }: { gap: IntakeGap; extraction: Layer1Extraction | null }) {
  if (!extraction) return null

  const field = gap.criteria.field as keyof Layer1Extraction
  const value = extraction[field]

  if (gap.criteria.type === 'boolean_false') {
    const boolVal = value as boolean
    return (
      <span className={boolVal ? styles.gapStatusTrue : styles.gapStatusFalse}>
        {boolVal ? 'True' : 'False'}
      </span>
    )
  }

  if (gap.criteria.type === 'empty_array') {
    const arr = value as string[]
    const present = arr && arr.length > 0
    return (
      <span className={present ? styles.gapStatusTrue : styles.gapStatusFalse}>
        {present ? 'Present' : 'Not Present'}
      </span>
    )
  }

  if (gap.criteria.type === 'length_threshold') {
    const count = value as number
    const threshold = gap.criteria.threshold ?? 0
    const passing = count >= threshold
    return (
      <span className={passing ? styles.gapStatusTrue : styles.gapStatusFalse}>
        {count} {passing ? '≥' : '<'} {threshold}
      </span>
    )
  }

  return null
}

function GapConfigCard({ gap, extraction }: { gap: IntakeGap; extraction: Layer1Extraction | null }) {
  const badgeClass = CRITERIA_TYPE_BADGE_CLASS[gap.criteria.type] ?? ''
  return (
    <div className={styles.gapCard}>
      <div className={styles.gapCardHeader}>
        <span className={styles.gapPriority}>{gap.priority}</span>
        <span className={styles.gapLabel}>{gap.label}</span>
        <span className={`${styles.criteriaBadge} ${badgeClass}`}>
          {CRITERIA_TYPE_LABELS[gap.criteria.type] ?? gap.criteria.type}
        </span>
        <GapStatusBadge gap={gap} extraction={extraction} />
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
    setAnalysisError(null)
    try {
      const raw = sessionStorage.getItem(LAST_INTAKE_ANALYSIS_STORAGE_KEY)
      if (!raw) {
        setAnalysisResult(null)
        return
      }
      const data = JSON.parse(raw) as Record<string, unknown>
      const extraction = normalizeExtraction(data.extraction)
      if (!extraction) {
        setAnalysisResult(null)
        return
      }
      setAnalysisResult({
        timestamp: String(data.timestamp ?? ''),
        extraction,
        gaps: Array.isArray(data.gaps) ? (data.gaps as string[]) : [],
        follow_up_questions: Array.isArray(data.follow_up_questions)
          ? (data.follow_up_questions as FollowUpQuestion[])
          : [],
        used_defaults: Boolean(data.used_defaults),
      })
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : 'Failed to read stored analysis')
      setAnalysisResult(null)
    } finally {
      setAnalysisLoading(false)
    }
  }, [])

  const fetchGaps = useCallback(() => {
    setGapsLoading(true)
    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.INTAKE_GAPS}`)
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
        AI evaluation of your most recent intake run in this browser tab — extraction, gap detection, and follow-up
        selection. Data is read from session storage (run analysis from the report form on the Home page first).
      </p>

      {/* ── Last Analysis Result ─────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Last Analysis Result</h2>
          <p className={styles.sectionDesc}>
            Populated when you complete intake analysis on the Home page (stored in this browser session only).
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
            <p className={styles.emptyStateText}>No analysis in this session yet.</p>
            <p className={styles.emptyStateHint}>
              On the Home page, complete the Full Details steps through intake analysis, then return here — or open this
              page in the same browser tab after analyzing.
            </p>
          </div>
        )}

        {!analysisLoading && !analysisError && analysisResult && (
          <>
            <p className={styles.timestamp}>
              Last analyzed: <strong>{formatTimestamp(analysisResult.timestamp)}</strong>
              {analysisResult.used_defaults ? (
                <span className={styles.emptyNote}> — Layer 1 used fallback defaults (unparseable model output).</span>
              ) : null}
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
            {gaps.map((gap) => <GapConfigCard key={gap.id} gap={gap} extraction={analysisResult?.extraction ?? null} />)}
          </div>
        )}
      </section>
    </div>
  )
}
