import { useState, useEffect } from 'react'
import { useBackendStatus } from '@/hooks/useBackendStatus'

const DISMISS_AFTER_MS = 4000

export function BackendStatusToast() {
  const status = useBackendStatus()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (status === 'ready') {
      const t = setTimeout(() => setVisible(false), DISMISS_AFTER_MS)
      return () => clearTimeout(t)
    }
  }, [status])

  if (!visible) return null

  const isReady = status === 'ready'
  const isUnavailable = status === 'unavailable'

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 20px',
      borderRadius: '10px',
      background: isUnavailable ? '#fef2f2' : isReady ? '#f0fdf4' : '#f8fafc',
      border: `1px solid ${isUnavailable ? '#fca5a5' : isReady ? '#86efac' : '#e2e8f0'}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '14px',
      color: isUnavailable ? '#991b1b' : isReady ? '#166534' : '#334155',
      fontFamily: 'system-ui, sans-serif',
      transition: 'opacity 0.3s ease',
      opacity: visible ? 1 : 0,
    }}>
      {status === 'checking' && (
        <>
          <Spinner />
          <span>Backend starting up...</span>
        </>
      )}
      {status === 'ready' && (
        <>
          <span style={{ fontSize: '16px' }}>&#10003;</span>
          <span>Backend ready</span>
        </>
      )}
      {status === 'unavailable' && (
        <>
          <span style={{ fontSize: '16px' }}>&#10007;</span>
          <span>Backend unavailable</span>
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid #e2e8f0',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'toast-spin 0.7s linear infinite',
    }}>
      <style>{`@keyframes toast-spin { to { transform: rotate(360deg) } }`}</style>
    </span>
  )
}
