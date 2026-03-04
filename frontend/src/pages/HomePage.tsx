import { ReportPanel } from '@/components/ReportPanel/ReportPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.wrapper}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to report
      </a>
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <ErrorBoundary>
          <ReportPanel />
        </ErrorBoundary>
      </main>
    </div>
  )
}
