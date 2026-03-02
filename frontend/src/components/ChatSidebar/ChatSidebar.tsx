import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatPanel } from '@/components/ChatPanel/ChatPanel'
import styles from './ChatSidebar.module.css'

const STORAGE_KEY_WIDTH = 'reportiq-sidebar-width'
const STORAGE_KEY_COLLAPSED = 'reportiq-sidebar-collapsed'
const MIN_WIDTH = 320
const MAX_WIDTH = 600
const DEFAULT_WIDTH = 380

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_WIDTH)
    if (stored) {
      const n = parseInt(stored, 10)
      if (!Number.isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDTH
}

function getStoredCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED)
    return stored === 'true'
  } catch {
    return false
  }
}

export function ChatSidebar() {
  const [sidebarWidth, setSidebarWidth] = useState(getStoredWidth)
  const [isCollapsed, setIsCollapsed] = useState(getStoredCollapsed)
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const resizeCountRef = useRef(0)
  const lastWidthRef = useRef(0)

  useEffect(() => {
    if (isResizing) return
    try {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(sidebarWidth))
    } catch {
      /* ignore */
    }
  }, [sidebarWidth, isResizing])

  useEffect(() => {
    if (!isResizing) return
    return () => {
      try {
        const w = lastWidthRef.current || sidebarWidth
        if (w) localStorage.setItem(STORAGE_KEY_WIDTH, String(w))
      } catch {
        /* ignore */
      }
    }
  }, [isResizing, sidebarWidth])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(isCollapsed))
    } catch {
      /* ignore */
    }
  }, [isCollapsed])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    if (!isResizing) return

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const flushWidth = () => {
      if (pendingWidth !== null) {
        setSidebarWidth(pendingWidth)
        lastWidthRef.current = pendingWidth
        pendingWidth = null
      }
      rafId = null
    }

    const handleMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + delta))
      resizeCountRef.current += 1
      pendingWidth = newWidth
      if (rafId === null) {
        rafId = requestAnimationFrame(flushWidth)
      }
    }

    const handleEnd = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      flushWidth()
      resizeCountRef.current = 0
      document.body.style.userSelect = ''
      setIsResizing(false)
    }

    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    return () => {
      document.body.style.userSelect = ''
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
    }
  }, [isResizing])

  const handleToggle = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  if (isCollapsed) {
    return (
      <button
        type="button"
        className={styles.floatingToggle}
        onClick={handleToggle}
        aria-label="Open chat sidebar"
      >
        <span className={styles.toggleIcon} aria-hidden>💬</span>
      </button>
    )
  }

  return (
    <aside
      className={styles.sidebar}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div
        className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
        onMouseDown={handleResizeStart}
        aria-hidden
      />
      <div className={styles.sidebarContent}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={handleToggle}
          aria-label="Close chat sidebar"
        >
          <span aria-hidden>×</span>
        </button>
        <ChatPanel />
      </div>
    </aside>
  )
}
