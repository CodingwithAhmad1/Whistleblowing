import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Mode = 'reporter' | 'investigator' | 'manager'

interface ModeContextValue {
  mode: Mode
  setMode: (mode: Mode) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('reporter')

  const setMode = (next: Mode) => {
    setModeState(next)
    document.documentElement.setAttribute('data-mode', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', 'reporter')
  }, [])

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  const ctx = useContext(ModeContext)
  if (!ctx) {
    throw new Error(
      'useMode must be used within ModeProvider. Wrap the tree (or the component under test) with <AppProviders> from @/providers/AppProviders, or use <ModeProvider> directly.',
    )
  }
  return ctx
}
