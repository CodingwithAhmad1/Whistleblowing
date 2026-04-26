import type { ReportData } from '@/types/report'
import { API_CONFIG } from '@/config'

export interface Layer1Extraction {
  summary: string
  dates_mentioned: string[]
  people_mentioned: string[]
  locations_mentioned: string[]
  specific_examples_present: boolean
  evidence_described: boolean
  timeline_clear: boolean
  witnesses_mentioned: boolean
  prior_reporting_mentioned: boolean
  impact_described: boolean
  retaliation_mentioned: boolean
  allegation_type: string[]
  length_character_count: number
}

/** Rule-based slice from structured form fields (no LLM). */
export interface ExtractionBreakdownFromAnswers {
  dates_mentioned: string[]
  people_mentioned: string[]
  locations_mentioned: string[]
  specific_examples_present: boolean
  evidence_described: boolean
  timeline_clear: boolean
  prior_reporting_mentioned: boolean
}

/** Pre-merge Layer-1 (narrative inference) for display; lists are model-only. */
export interface ExtractionBreakdownFromModel {
  summary: string
  dates_mentioned: string[]
  people_mentioned: string[]
  locations_mentioned: string[]
  specific_examples_present: boolean
  evidence_described: boolean
  timeline_clear: boolean
  witnesses_mentioned: boolean
  prior_reporting_mentioned: boolean
  impact_described: boolean
  retaliation_mentioned: boolean
  allegation_type: string[]
  length_character_count: number
  used_defaults: boolean
}

export interface ExtractionBreakdown {
  from_answers: ExtractionBreakdownFromAnswers
  from_model: ExtractionBreakdownFromModel
}

export interface FollowUpQuestion {
  gap_id: string
  question_text: string
}

export interface StoredSubmission {
  id: number
  timestamp: string
  formData: ReportData
  extraction: Layer1Extraction | null
  /** Algorithmic vs model narrative breakdown (optional for legacy rows). */
  extractionBreakdown?: ExtractionBreakdown | null
  gaps: string[]
  followUpQuestions: FollowUpQuestion[]
}

export const SUBMISSIONS_STORAGE_KEY = 'whistleblow_submissions'

export const SUBMISSIONS_UPDATED_EVENT = 'whistleblow:submissions-updated'

const SUBMISSIONS_API = `${API_CONFIG.BASE_URL}/api/submissions`

function _notifySubmissionsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SUBMISSIONS_UPDATED_EVENT))
}

function loadSubmissionsLocal(): StoredSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoredSubmission[]
  } catch {
    return []
  }
}

function saveSubmissionLocal(data: Omit<StoredSubmission, 'id'>): StoredSubmission {
  const existing = loadSubmissionsLocal()
  const nextId = existing.length > 0 ? Math.max(...existing.map(s => s.id)) + 1 : 1
  const submission: StoredSubmission = { id: nextId, ...data }
  existing.push(submission)
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(existing))
  _notifySubmissionsChanged()
  return submission
}

function deleteSubmissionLocal(id: number): void {
  const existing = loadSubmissionsLocal()
  const updated = existing.filter(s => s.id !== id)
  localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))
  _notifySubmissionsChanged()
}

/** Browser-only copy (for import-to-server and offline fallback). */
export function getLocalSubmissionsOnly(): StoredSubmission[] {
  return loadSubmissionsLocal()
}

export async function loadSubmissions(): Promise<StoredSubmission[]> {
  try {
    const res = await fetch(SUBMISSIONS_API)
    if (res.ok) {
      return (await res.json()) as StoredSubmission[]
    }
  } catch {
    /* backend down */
  }
  console.warn('[Feed] API unavailable; using localStorage only')
  return loadSubmissionsLocal()
}

export async function saveSubmission(data: Omit<StoredSubmission, 'id'>): Promise<StoredSubmission> {
  const body = {
    timestamp: data.timestamp,
    formData: data.formData,
    extraction: data.extraction,
    extractionBreakdown: data.extractionBreakdown,
    gaps: data.gaps,
    followUpQuestions: data.followUpQuestions,
  }
  try {
    const res = await fetch(SUBMISSIONS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const s = (await res.json()) as StoredSubmission
      _notifySubmissionsChanged()
      return s
    }
  } catch (e) {
    console.error('[Feed] API save failed:', e)
  }
  console.warn('[Feed] Saved to localStorage only; start the API to share the feed')
  return saveSubmissionLocal(data)
}

export async function deleteSubmission(id: number): Promise<void> {
  try {
    const res = await fetch(`${SUBMISSIONS_API}/${id}`, { method: 'DELETE' })
    if (res.ok) {
      _notifySubmissionsChanged()
      return
    }
  } catch {
    /* fallback */
  }
  deleteSubmissionLocal(id)
}

/** Push all local-only rows to the server, then clear local storage on full success. */
export async function importLocalSubmissionsToServer(): Promise<{
  ok: boolean
  imported: number
  error?: string
}> {
  const local = loadSubmissionsLocal()
  if (local.length === 0) {
    return { ok: true, imported: 0 }
  }
  let imported = 0
  for (const s of local) {
    const { id: _id, ...rest } = s
    try {
      const res = await fetch(SUBMISSIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: rest.timestamp,
          formData: rest.formData,
          extraction: rest.extraction,
          extractionBreakdown: rest.extractionBreakdown,
          gaps: rest.gaps,
          followUpQuestions: rest.followUpQuestions,
        }),
      })
      if (!res.ok) {
        const t = await res.text()
        return { ok: false, imported, error: t || `HTTP ${res.status}` }
      }
      imported += 1
    } catch (e) {
      return { ok: false, imported, error: e instanceof Error ? e.message : String(e) }
    }
  }
  localStorage.removeItem(SUBMISSIONS_STORAGE_KEY)
  _notifySubmissionsChanged()
  return { ok: true, imported }
}

export function submissionPdfFilename(submission: StoredSubmission): string {
  const d = new Date(submission.timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getUTCFullYear()
  const mo = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  const h = pad(d.getUTCHours())
  const mi = pad(d.getUTCMinutes())
  const sec = pad(d.getUTCSeconds())
  return `whistleblowing-report-id${submission.id}-${y}${mo}${day}T${h}${mi}${sec}Z.pdf`
}
