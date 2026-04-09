import type { ReportData } from '@/types/report'

export interface Layer1Extraction {
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
