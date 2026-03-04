import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ReportProvider } from '@/context/ReportContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Navbar } from '@/components/Navbar/Navbar'
import { HomePage } from '@/pages/HomePage'
import { AdminPage } from '@/pages/AdminPage'
import { useWebVitals } from '@/hooks/useWebVitals'
import styles from './App.module.css'

function AppContent() {
  const { reportWebVitals } = useWebVitals()

  useEffect(() => {
    reportWebVitals()
  }, [reportWebVitals])

  return (
    <div className={styles.app}>
      <Navbar />
      <div className={styles.layout}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ReportProvider>
        <AppContent />
      </ReportProvider>
    </ErrorBoundary>
  )
}

export { App }
