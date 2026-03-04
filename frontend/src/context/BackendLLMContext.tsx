/**
 * Context for managing backend LLM connection
 * Replaces the WebLLM context with backend API
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { WebSocketClient } from '@/services/websocketClient'

type LoadStatus = 'idle' | 'connecting' | 'ready' | 'error'

interface BackendLLMContextType {
  loadStatus: LoadStatus
  errorMessage: string | null
  connect: () => Promise<void>
  disconnect: () => void
  sendMessage: (
    message: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onReportUpdate?: (data: Record<string, string>) => void,
    onError?: (error: string) => void
  ) => void
  isConnected: boolean
}

const BackendLLMContext = createContext<BackendLLMContextType | null>(null)

export function BackendLLMProvider({ children }: { children: ReactNode }) {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`)

  const connect = useCallback(async () => {
    if (loadStatus === 'ready' || loadStatus === 'connecting') return

    setLoadStatus('connecting')
    setErrorMessage(null)

    try {
      const client = new WebSocketClient(sessionId, {
        onConnect: () => {
          setLoadStatus('ready')
        },
        onDisconnect: () => {
          setLoadStatus('idle')
        },
        // onError here is for connection-level errors only; per-message errors
        // are forwarded to the caller via sendMessage's onError callback.
      })

      await client.connect()
      setWsClient(client)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to backend'
      setErrorMessage(message)
      setLoadStatus('error')
    }
  }, [sessionId, loadStatus])

  const disconnect = useCallback(() => {
    if (wsClient) {
      wsClient.disconnect()
      setWsClient(null)
      setLoadStatus('idle')
    }
  }, [wsClient])

  const sendMessage = useCallback((
    message: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onReportUpdate?: (data: Record<string, string>) => void,
    onError?: (error: string) => void,
  ) => {
    if (!wsClient || !wsClient.isConnected()) {
      throw new Error('Not connected to backend')
    }

    wsClient.callbacks.onToken = onToken
    wsClient.callbacks.onDone = onDone
    wsClient.callbacks.onReportUpdate = onReportUpdate
    // Per-message error goes to caller, not to connection-level error state
    wsClient.callbacks.onError = onError

    wsClient.sendMessage(message)
  }, [wsClient])

  const value: BackendLLMContextType = {
    loadStatus,
    errorMessage,
    connect,
    disconnect,
    sendMessage,
    isConnected: wsClient?.isConnected() ?? false
  }

  return (
    <BackendLLMContext.Provider value={value}>
      {children}
    </BackendLLMContext.Provider>
  )
}

export function useBackendLLM() {
  const context = useContext(BackendLLMContext)
  if (!context) {
    throw new Error('useBackendLLM must be used within BackendLLMProvider')
  }
  return context
}
