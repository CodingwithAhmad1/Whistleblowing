import { useState, useEffect, useRef } from 'react'
import { API_CONFIG } from '@/config'
import type { ReportData } from '@/types/report'

interface PolicyQuoteResult {
  quote: string | null
  section: string | null
  isLoading: boolean
  error: string | null
  reset: () => void
}

const TIMEOUT_MS = 8000

export function usePolicyQuote(
  formData: Partial<ReportData>,
  enabled: boolean,
  constructedSentence?: string | null,
): PolicyQuoteResult {
  const [quote, setQuote] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
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
    let active = true

    const timeout = setTimeout(() => {
      timedOutRef.current = true
      ac.abort()
    }, TIMEOUT_MS)

    setIsLoading(true)
    setError(null)
    setQuote(null)
    setSection(null)

    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RAG_POLICY_QUOTE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_data: formData,
        ...(constructedSentence ? { constructed_sentence: constructedSentence } : {}),
      }),
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`)
        return r.json()
      })
      .then((res: { quote: string | null; section: string | null; error?: string }) => {
        if (!active) return
        setQuote(res.quote)
        setSection(res.section)
        if (res.error && !res.quote) {
          setError(res.error)
        }
      })
      .catch((e) => {
        if (!active) return
        if (timedOutRef.current) {
          setError('Request timed out')
        } else if (e?.name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Failed to retrieve policy quote')
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
      clearTimeout(timeout)
      ac.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, constructedSentence])

  const reset = () => {
    abortRef.current?.abort()
    setQuote(null)
    setSection(null)
    setIsLoading(false)
    setError(null)
  }

  return { quote, section, isLoading, error, reset }
}
