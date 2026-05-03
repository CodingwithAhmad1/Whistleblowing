import { useState, useEffect, useRef, useCallback } from 'react'
import { API_CONFIG } from '@/config'

/** `warming` = HTTP API is up but LLM (`ready` in JSON) is still initializing. */
export type BackendStatus = 'checking' | 'warming' | 'ready' | 'degraded' | 'unavailable'

const INITIAL_BACKOFF_MS = 2000
const BACKOFF_MULTIPLIER = 1.35
const MAX_BACKOFF_MS = 12000
/** Retries when the API is not reachable at all (connection errors / no listener). */
const MAX_CONNECT_POLLS = 150
/** Poll interval once `/api/health` returns 200 but `ready` is still false (Gemini warming). */
const WARMING_POLL_MS = 4000
/** Stop waiting for LLM readiness after this many slow polls (~6.7 min at 4s). */
const MAX_WARMING_POLLS = 100
const FETCH_TIMEOUT_MS = 8000

function nextDelayMs(failedSinceReadyCheck: number): number {
  if (failedSinceReadyCheck <= 0) return 0
  const raw = INITIAL_BACKOFF_MS * BACKOFF_MULTIPLIER ** (failedSinceReadyCheck - 1)
  return Math.min(Math.round(raw), MAX_BACKOFF_MS)
}

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>('checking')
  const notified = useRef(false)

  const sendNotification = useCallback((title: string, body: string) => {
    if (notified.current) return
    notified.current = true
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | undefined

    let failedStreak = 0
    let connectPolls = 0
    let warmingPolls = 0

    const runConnectBackoff = () => {
      if (cancelled) return
      if (pollTimer) clearTimeout(pollTimer)
      const delay = nextDelayMs(failedStreak)
      pollTimer = setTimeout(tick, delay)
    }

    const scheduleWarming = () => {
      if (cancelled) return
      if (pollTimer) clearTimeout(pollTimer)
      pollTimer = setTimeout(tick, WARMING_POLL_MS)
    }

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (cancelled) return

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = (await res.json()) as {
          ready?: boolean
          status?: string
          error?: string
        }

        if (data.ready) {
          setStatus('ready')
          sendNotification('ReportIQ', 'Backend is ready.')
          return
        }

        // API is responding; LLM may still be initializing (or misconfigured).
        failedStreak = 0
        connectPolls = 0
        setStatus('warming')

        warmingPolls += 1
        if (warmingPolls >= MAX_WARMING_POLLS) {
          setStatus('degraded')
          return
        }

        scheduleWarming()
      } catch {
        if (cancelled) return
        connectPolls += 1
        failedStreak += 1
        setStatus('checking')
        if (connectPolls >= MAX_CONNECT_POLLS) {
          setStatus('unavailable')
          return
        }
        runConnectBackoff()
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [sendNotification])

  return status
}
