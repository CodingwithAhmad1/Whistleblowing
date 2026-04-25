import type { ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ModeProvider } from '@/context/ModeContext'
import { ReportProvider } from '@/context/ReportContext'

/**
 * Single composition point for all app-level providers.
 * Use this in `main.tsx` (and any future entry points like tests) so context
 * like `useMode` / `useReport` always see a consistent tree.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ModeProvider>
        <ReportProvider>{children}</ReportProvider>
      </ModeProvider>
    </ErrorBoundary>
  )
}
