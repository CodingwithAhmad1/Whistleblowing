import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  initialReportData,
  type ReportData,
} from '@/types/report'
import type { ChatMessage } from '@/types/chat'
import type { Layer1Extraction, FollowUpQuestion } from '@/utils/feedStore'

export type PipelineStatus = 'idle' | 'analyzing' | 'constructing' | 'policyLoading' | 'ready' | 'error'

export interface AnalysisSnapshot {
  extraction: Layer1Extraction | null
  gaps: string[]
  follow_up_questions: FollowUpQuestion[]
}

interface ReportContextValue {
  report: ReportData
  updateReport: (updates: Partial<ReportData>) => void
  messages: ChatMessage[]
  addMessage: (role: 'ai' | 'user', content: string) => void
  removeLastMessage: () => void
  pipelineStatus: PipelineStatus
  setPipelineStatus: (status: PipelineStatus) => void
  intakeAnalysisResult: AnalysisSnapshot | null
  setIntakeAnalysisResult: (result: AnalysisSnapshot | null) => void
  /** Increments to remount Full Details questionnaire (clears local step after errors). */
  fullDetailsMountKey: number
  /** Clears pipeline error state and intake snapshot; remounts the AI follow-up block so Submit is enabled. */
  resetAIFullDetailsWorkflow: () => void
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
  const [intakeAnalysisResult, setIntakeAnalysisResult] = useState<AnalysisSnapshot | null>(null)
  const [fullDetailsMountKey, setFullDetailsMountKey] = useState(0)

  const resetAIFullDetailsWorkflow = useCallback(() => {
    setPipelineStatus('idle')
    setIntakeAnalysisResult(null)
    setFullDetailsMountKey((k) => k + 1)
  }, [])

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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasData =
        messages.length > 1 ||
        Object.values(report).some((v) => typeof v === 'string' && v.trim() !== '')
      if (!hasData) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [messages, report])

  const value = useMemo<ReportContextValue>(
    () => ({
      report,
      updateReport,
      messages,
      addMessage,
      removeLastMessage,
      pipelineStatus,
      setPipelineStatus,
      intakeAnalysisResult,
      setIntakeAnalysisResult,
      fullDetailsMountKey,
      resetAIFullDetailsWorkflow,
    }),
    [
      report,
      updateReport,
      messages,
      addMessage,
      removeLastMessage,
      pipelineStatus,
      intakeAnalysisResult,
      fullDetailsMountKey,
      resetAIFullDetailsWorkflow,
    ],
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
