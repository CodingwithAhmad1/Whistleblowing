import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  initialReportData,
  type ReportData,
} from '@/types/report'
import type { ChatMessage } from '@/types/chat'

export type PipelineStatus = 'idle' | 'analyzing' | 'constructing' | 'policyLoading' | 'ready' | 'error'

interface ReportContextValue {
  report: ReportData
  updateReport: (updates: Partial<ReportData>) => void
  messages: ChatMessage[]
  addMessage: (role: 'ai' | 'user', content: string) => void
  removeLastMessage: () => void
  pipelineStatus: PipelineStatus
  setPipelineStatus: (status: PipelineStatus) => void
}

const ReportContext = createContext<ReportContextValue | null>(null)

const INITIAL_AI_MESSAGE: ChatMessage = {
  id: 'ai-0',
  role: 'ai',
  content:
    "Hello - I'm your ReportIQ assistant. I'll ask a few questions and build your report draft as we go. To start: What happened? Please describe what you observed and why you believe it's inappropriate.",
}

export function ReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<ReportData>(initialReportData)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_AI_MESSAGE])
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>('idle')

  const updateReport = useCallback((updates: Partial<ReportData>) => {
    setReport((prev) => ({ ...prev, ...updates }))
  }, [])

  const MAX_MESSAGES = 50

  const addMessage = useCallback((role: 'ai' | 'user', content: string) => {
    const id = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    setMessages((prev) => {
      const next = [...prev, { id, role, content }]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })
  }, [])

  const removeLastMessage = useCallback(() => {
    setMessages((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const value = useMemo<ReportContextValue>(
    () => ({
      report,
      updateReport,
      messages,
      addMessage,
      removeLastMessage,
      pipelineStatus,
      setPipelineStatus,
    }),
    [report, updateReport, messages, addMessage, removeLastMessage, pipelineStatus]
  )

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  )
}

export function useReport() {
  const ctx = useContext(ReportContext)
  if (!ctx) throw new Error('useReport must be used within ReportProvider')
  return ctx
}
