import { useEffect } from 'react'
import { ReportProvider } from '@/context/ReportContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ReportPanel } from '@/components/ReportPanel/ReportPanel'
import { useWebVitals } from '@/hooks/useWebVitals'
import styles from './App.module.css'

function AppContent() {
  const { reportWebVitals } = useWebVitals()

  useEffect(() => {
    reportWebVitals()
  }, [reportWebVitals])

  return (
    <div className={styles.app}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to report
      </a>
      <div className={styles.layout}>
        <main id="main-content" className={styles.reportColumn} tabIndex={-1}>
          <ErrorBoundary>
            <ReportPanel />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <ReportProvider>
        <AppContent />
      </ReportProvider>
    </ErrorBoundary>
  )
}
