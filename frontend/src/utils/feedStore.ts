import type { ReportData } from '@/types/report'

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

export interface FollowUpQuestion {
  gap_id: string
  question_text: string
}

export interface StoredSubmission {
  id: number
  timestamp: string           // ISO UTC
  formData: ReportData
  extraction: Layer1Extraction | null
  gaps: string[]
  followUpQuestions: FollowUpQuestion[]
}

const STORAGE_KEY = 'whistleblow_submissions'

export function loadSubmissions(): StoredSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as StoredSubmission[]
  } catch {
    return []
  }
}

export function deleteSubmission(id: number): void {
  const existing = loadSubmissions()
  const updated = existing.filter(s => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

/** Safe filesystem characters; stable per submission for PDF exports. */
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

export function saveSubmission(data: Omit<StoredSubmission, 'id'>): void {
  try {
    const existing = loadSubmissions()
    const nextId = existing.length > 0 ? Math.max(...existing.map(s => s.id)) + 1 : 1
    const submission: StoredSubmission = { id: nextId, ...data }
    existing.push(submission)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
  } catch (e) {
    console.error('[Feed] Failed to save submission:', e)
  }
}
