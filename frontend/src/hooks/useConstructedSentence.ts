import { useState, useEffect, useRef } from 'react'
import { API_CONFIG } from '@/config'
import type { ReportData } from '@/types/report'

interface ConstructedSentenceResult {
  sentence: string | null
  isLoading: boolean
  error: string | null
  reset: () => void
}

const TIMEOUT_MS = 10000

export function useConstructedSentence(
  formData: Partial<ReportData>,
  enabled: boolean,
): ConstructedSentenceResult {
  const [sentence, setSentence] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timedOutRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    timedOutRef.current = false

    const timeout = setTimeout(() => {
      timedOutRef.current = true
      ac.abort()
    }, TIMEOUT_MS)

    setIsLoading(true)
    setError(null)
    setSentence(null)

    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RAG_CONSTRUCT_SENTENCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_data: formData }),
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`)
        return r.json()
      })
      .then((res: { sentence: string; error?: string }) => {
        setSentence(res.sentence || null)
        if (res.error && !res.sentence) {
          setError(res.error)
        }
      })
      .catch((e) => {
        if (timedOutRef.current) {
          setError('Request timed out')
        } else if (e?.name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Failed to build case summary')
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        setIsLoading(false)
      })

    return () => {
      clearTimeout(timeout)
      ac.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const reset = () => {
    abortRef.current?.abort()
    setSentence(null)
    setIsLoading(false)
    setError(null)
  }

  return { sentence, isLoading, error, reset }
}
