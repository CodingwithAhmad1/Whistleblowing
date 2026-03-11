import { useState, useEffect, useRef } from 'react'
import { API_CONFIG } from '@/config'
import type { ReportData } from '@/types/report'

interface PolicyQuoteResult {
  quote: string | null
  section: string | null
  isLoading: boolean
  error: string | null
}

const TIMEOUT_MS = 8000

export function usePolicyQuote(
  formData: Partial<ReportData>,
  enabled: boolean,
): PolicyQuoteResult {
  const [quote, setQuote] = useState<string | null>(null)
  const [section, setSection] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS)

    setIsLoading(true)
    setError(null)
    setQuote(null)
    setSection(null)

    fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.RAG_POLICY_QUOTE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_data: formData }),
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`)
        return r.json()
      })
      .then((res: { quote: string | null; section: string | null; error?: string }) => {
        setQuote(res.quote)
        setSection(res.section)
        if (res.error && !res.quote) {
          setError(res.error)
        }
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') {
          setError(e instanceof Error ? e.message : 'Failed to retrieve policy quote')
        }
      })
      .finally(() => {
        clearTimeout(timeout)
        if (!ac.signal.aborted) setIsLoading(false)
      })

    return () => {
      clearTimeout(timeout)
      ac.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { quote, section, isLoading, error }
}
