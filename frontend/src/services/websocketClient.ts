/**
 * WebSocket client for backend LLM chat
 * Replaces the WebLLM browser-based inference
 */

import { API_CONFIG } from '@/config'

export type WSMessageType = 'token' | 'done' | 'report_update' | 'error'

export interface WSMessage {
  type: WSMessageType
  content?: string
  data?: Record<string, string> | Record<string, boolean>
  message?: string
}

export interface WSClientCallbacks {
  onToken?: (token: string) => void
  onDone?: () => void
  onReportUpdate?: (data: Record<string, string>) => void
  onError?: (error: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private sessionId: string
  public callbacks: WSClientCallbacks  // Changed to public for context access
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 1000
  private pendingCallbacks: {
    onToken?: (token: string) => void
    onDone?: () => void
    onReportUpdate?: (data: Record<string, string>) => void
  } | null = null
  private isBusy = false

  constructor(sessionId: string, callbacks: WSClientCallbacks = {}) {
    this.sessionId = sessionId
    this.callbacks = callbacks
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.getWebSocketUrl()
      
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = async () => {
        console.log('WebSocket connected')
        const wasReconnect = this.reconnectAttempts > 0
        this.reconnectAttempts = 0
        this.isBusy = false
        this.pendingCallbacks = null

        // Resync state on reconnection
        if (wasReconnect) {
          console.log('Reconnected - resyncing state...')
          await this.resyncState()
        }

        this.callbacks.onConnect?.()
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.callbacks.onDisconnect?.()
        this.ws = null
        
        // Auto-reconnect logic
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          setTimeout(() => {
            console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
            this.connect().catch(console.error)
          }, this.reconnectDelay * this.reconnectAttempts)
        }
      }
    })
  }

  private async resyncState(): Promise<void> {
    // Fetch current state from backend after reconnection
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/reports/${this.sessionId}`)
      if (response.ok) {
        const data = await response.json()
        
        // Trigger callbacks to update frontend state
        if (data.report && this.callbacks.onReportUpdate) {
          this.callbacks.onReportUpdate(data.report)
        }

        console.log('State resynced successfully')
      }
    } catch (error) {
      console.error('Failed to resync state:', error)
    }
  }

  private getWebSocketUrl(): string {
    // Convert http/https to ws/wss
    const baseUrl = API_CONFIG.BASE_URL.replace(/^http/, 'ws')
    return `${baseUrl}/api/chat/${this.sessionId}`
  }

  private handleMessage(message: WSMessage) {
    const cb = this.pendingCallbacks
    switch (message.type) {
      case 'token':
        if (message.content) {
          ;(cb?.onToken ?? this.callbacks.onToken)?.(message.content)
        }
        break

      case 'done':
        ;(cb?.onDone ?? this.callbacks.onDone)?.()
        this.pendingCallbacks = null
        this.isBusy = false
        break

      case 'report_update':
        if (message.data) {
          ;(cb?.onReportUpdate ?? this.callbacks.onReportUpdate)?.(message.data as Record<string, string>)
        }
        break

      case 'error':
        if (message.message) {
          this.callbacks.onError?.(message.message)
        }
        this.pendingCallbacks = null
        this.isBusy = false
        break
    }
  }

  sendMessage(
    content: string,
    messageCallbacks?: {
      onToken?: (token: string) => void
      onDone?: () => void
      onReportUpdate?: (data: Record<string, string>) => void
    }
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }
    if (this.isBusy) {
      throw new Error('A message is already being processed')
    }

    this.isBusy = true
    this.pendingCallbacks = messageCallbacks ?? null

    this.ws.send(JSON.stringify({
      type: 'message',
      content
    }))
  }

  get busy(): boolean {
    return this.isBusy
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
