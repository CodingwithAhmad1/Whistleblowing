import { useState, useEffect, useRef } from 'react'
import { API_CONFIG } from '@/config'

/** Session-only copy of the last intake pipeline result (for Analysis page). */
export const LAST_INTAKE_ANALYSIS_STORAGE_KEY = 'whistleblow_lastIntakeAnalysis'

export interface FollowUpQuestion {
  gap_id: string
  question_text: string
}

export interface FullAnalysisResult {
  extraction: Record<string, unknown> | null
  gaps: string[]
  follow_up_questions: FollowUpQuestion[]
  used_defaults?: boolean
}

export interface IntakeAnalysisResult {
  follow_up_questions: FollowUpQuestion[]
}

// Any admin settings save bumps this key to invalidate cached analysis results.
const SETTINGS_MODIFIED_KEY = 'whistleblow_settingsModified'

function cacheKey(q1Text: string): string {
  const settingsVersion =
    typeof window !== 'undefined'
      ? (sessionStorage.getItem(SETTINGS_MODIFIED_KEY) ?? '0')
      : '0'
  return q1Text + '::' + settingsVersion
}

export function useIntakeAnalysis(
  q1Text: string,
  enabled: boolean,
  formData?: Record<string, string>,
): {
  followUpQuestions: FollowUpQuestion[]
  analysisResult: FullAnalysisResult | null
  isLoading: boolean
  hasAnalyzed: boolean
  error: string | null
  reset: () => void
} {
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([])
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, FullAnalysisResult>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !q1Text.trim()) return

    const key = cacheKey(q1Text)
    const cached = cacheRef.current.get(key)
    if (cached) {
      setFollowUpQuestions(cached.follow_up_questions)
      setAnalysisResult(cached)
      setIsLoading(false)
      setHasAnalyzed(true)
      setError(null)
      return
    }

    // Abort any in-flight request
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setIsLoading(true)
    setError(null)
    setFollowUpQuestions([])

    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.INTAKE_ANALYZE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q1_text: q1Text,
        ...(formData ? { form_data: formData } : {}),
      }),
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status >= 500 ? 'Server error' : `Request failed: ${r.status}`)
        return r.json()
      })
      .then((res: FullAnalysisResult) => {
        const result: FullAnalysisResult = {
          extraction: res?.extraction ?? null,
          gaps: res?.gaps ?? [],
          follow_up_questions: res?.follow_up_questions ?? [],
          used_defaults: Boolean((res as FullAnalysisResult)?.used_defaults),
        }
        cacheRef.current.set(key, result)
        setFollowUpQuestions(result.follow_up_questions)
        setAnalysisResult(result)
        setHasAnalyzed(true)
        try {
          const stamped = {
            timestamp: new Date().toISOString(),
            extraction: result.extraction,
            gaps: result.gaps,
            follow_up_questions: result.follow_up_questions,
            used_defaults: result.used_defaults ?? false,
          }
          sessionStorage.setItem(LAST_INTAKE_ANALYSIS_STORAGE_KEY, JSON.stringify(stamped))
        } catch {
          /* quota or private mode */
        }
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Failed to analyze report')
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setIsLoading(false)
      })

    return () => ac.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q1Text, enabled])  // cacheKey() reads sessionStorage but is not reactive; reset() clears if needed

  const reset = () => {
    abortRef.current?.abort()
    setFollowUpQuestions([])
    setAnalysisResult(null)
    setIsLoading(false)
    setHasAnalyzed(false)
    setError(null)
    cacheRef.current.clear()
  }

  return { followUpQuestions, analysisResult, isLoading, hasAnalyzed, error, reset }
}
