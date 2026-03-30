import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ReportProvider } from '@/context/ReportContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Navbar } from '@/components/Navbar/Navbar'
import { BackendStatusToast } from '@/components/BackendStatusToast'
import { useWebVitals } from '@/hooks/useWebVitals'
import styles from './App.module.css'

const HomePage = lazy(() => import('@/pages/HomePage').then(m => ({ default: m.HomePage })))
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })))
const AnalysisPage = lazy(() => import('@/pages/AnalysisPage').then(m => ({ default: m.AnalysisPage })))

function PageFallback() {
  return (
    <div className={styles.pageFallback}>
      <div className={styles.spinner} />
    </div>
  )
}

function AppContent() {
  const { reportWebVitals } = useWebVitals()
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    reportWebVitals()
  }, [reportWebVitals])

  return (
    <div className={styles.app}>
      <Navbar />
      <BackendStatusToast />
      <div className={styles.layout}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
          </Routes>
        </Suspense>
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
