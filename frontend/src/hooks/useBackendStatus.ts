import { useState, useEffect, useRef, useCallback } from 'react'
import { API_CONFIG } from '@/config'

export type BackendStatus = 'checking' | 'ready' | 'unavailable'

const INITIAL_BACKOFF_MS = 2000
const BACKOFF_MULTIPLIER = 1.35
const MAX_BACKOFF_MS = 12000
const MAX_POLLS = 150
const FETCH_TIMEOUT_MS = 3000

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
    let totalPolls = 0

    const runCheck = () => {
      if (cancelled) return
      if (pollTimer) clearTimeout(pollTimer)
      const delay = nextDelayMs(failedStreak)
      pollTimer = setTimeout(tick, delay)
    }

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json()) as { ready?: boolean }
          if (data.ready) {
            setStatus('ready')
            sendNotification('ReportIQ', 'Backend is ready.')
            return
          }
        }
      } catch {
        // backend not up or network error
      }

      if (cancelled) return
      totalPolls += 1
      failedStreak += 1
      if (totalPolls >= MAX_POLLS) {
        setStatus('unavailable')
        return
      }
      runCheck()
    }

    void tick()
    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [sendNotification])

  return status
}
