import { useState, useEffect, useRef, useCallback } from 'react'
import { API_CONFIG } from '@/config'

export type BackendStatus = 'checking' | 'ready' | 'unavailable'

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 150 // 5 minutes max

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>('checking')
  const pollCount = useRef(0)
  const notified = useRef(false)

  const sendNotification = useCallback((title: string, body: string) => {
    if (notified.current) return
    notified.current = true

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }, [])

  useEffect(() => {
    // Request notification permission early
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    let timer: ReturnType<typeof setTimeout>
    let cancelled = false

    const checkHealth = async () => {
      try {
        const res = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.HEALTH, {
          signal: AbortSignal.timeout(3000),
        })
        if (!cancelled && res.ok) {
          const data = await res.json()
          if (data.ready) {
            setStatus('ready')
            sendNotification('ReportIQ', 'Backend is ready.')
            return // stop polling
          }
        }
      } catch {
        // backend not up yet
      }

      pollCount.current++
      if (!cancelled && pollCount.current < MAX_POLLS) {
        timer = setTimeout(checkHealth, POLL_INTERVAL_MS)
      } else if (!cancelled) {
        setStatus('unavailable')
      }
    }

    checkHealth()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sendNotification])

  return status
}
