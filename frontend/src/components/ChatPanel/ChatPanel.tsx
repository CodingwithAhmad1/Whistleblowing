import { useEffect, useMemo, useRef, useState } from 'react'
import { useReport } from '@/context/ReportContext'
import { useBackendLLM } from '@/context/BackendLLMContext'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const { messages, addMessage, updateReport } = useReport()
  const { loadStatus, errorMessage, connect, sendMessage } = useBackendLLM()
  const [input, setInput] = useState('')
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const pendingUserMessageRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleActivate = () => {
    connect()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (submittingRef.current || !trimmed || loadStatus !== 'ready' || isSubmitting) return

    submittingRef.current = true
    pendingUserMessageRef.current = trimmed
    addMessage('user', trimmed)
    setInput('')
    setIsSubmitting(true)
    setStreamingContent('')

    const resetSubmitting = () => {
      submittingRef.current = false
      pendingUserMessageRef.current = null
      if (isMountedRef.current) {
        setStreamingContent(null)
        setIsSubmitting(false)
      }
    }

    try {
      let accumulated = ''

      sendMessage(
        trimmed,
        (token: string) => {
          accumulated += token
          if (isMountedRef.current) setStreamingContent(accumulated)
        },
        () => {
          addMessage('ai', accumulated)
          resetSubmitting()
        },
        (data: Record<string, string>) => {
          updateReport(data)
        },
        (error: string) => {
          addMessage('ai', `Sorry, I encountered an error: ${error}`)
          resetSubmitting()
        }
      )
    } catch (err) {
      addMessage(
        'ai',
        `Sorry, an error occurred: ${err instanceof Error ? err.message : 'Unknown error'}.`
      )
      resetSubmitting()
    }
  }

  const displayMessages = useMemo(() => {
    let out: Array<{ id: string; role: 'ai' | 'user'; content: string }> = [...messages]
    if (streamingContent !== null) {
      const pending = pendingUserMessageRef.current
      if (pending) {
        const lastMsg = messages[messages.length - 1]
        const alreadyShown = lastMsg?.role === 'user' && lastMsg?.content === pending
        if (!alreadyShown) {
          out = [...out, { id: 'pending-user', role: 'user' as const, content: pending }]
        }
      }
      out = [...out, { id: 'streaming', role: 'ai' as const, content: streamingContent }]
    }
    return out
  }, [messages, streamingContent])

  const canSubmit = loadStatus === 'ready' && !isSubmitting && input.trim()

  return (
    <div className={styles.panel}>
      {loadStatus === 'connecting' && (
        <div className={styles.loadingArea}>
          <p className={styles.progressText}>
            Connecting to backend...
          </p>
        </div>
      )}

      {loadStatus === 'error' && (
        <div className={styles.errorArea}>
          <p className={styles.errorText}>{errorMessage}</p>
          <p className={styles.errorHint}>
            Unable to connect to backend. Please ensure the server is running.
          </p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => connect()}
          >
            Retry
          </button>
        </div>
      )}

      <div className={styles.messages}>
        {displayMessages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === 'ai' ? styles.chatBubble : styles.userBubble}
          >
            {msg.role === 'ai' && (
              <span className={styles.avatar} aria-hidden>AI</span>
            )}
            <p className={styles.messageText}>
              {msg.content || (msg.id === 'streaming' ? '...' : '')}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        {loadStatus === 'idle' && (
          <div className={styles.activateBottom}>
            <button
              type="button"
              className={styles.activateLink}
              onClick={handleActivate}
            >
              Activate AI to get started
            </button>
            <p className={styles.activateHintInline}>
              Connect to the backend AI server to start chatting.
            </p>
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            loadStatus !== 'ready'
              ? 'Click Activate to enable AI'
              : 'Type your response...'
          }
          className={styles.input}
          rows={3}
          aria-label="Chat message"
          disabled={loadStatus !== 'ready' || isSubmitting}
        />
        <button
          type="submit"
          className={styles.submit}
          disabled={!canSubmit}
          aria-label="Send message"
        >
          →
        </button>
      </form>
    </div>
  )
}
