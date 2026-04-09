import { DocSidebar } from '@/components/document/DocSidebar'
import { DocIntroduction } from '@/components/document/sections/DocIntroduction'
import { DocWhoItServes } from '@/components/document/sections/DocWhoItServes'
import { DocTheProblem } from '@/components/document/sections/DocTheProblem'
import { DocHowFormWorks } from '@/components/document/sections/DocHowFormWorks'
import { DocIntelligenceLayer } from '@/components/document/sections/DocIntelligenceLayer'
import { DocQ1 } from '@/components/document/sections/DocQ1'
import { DocQ2 } from '@/components/document/sections/DocQ2'
import { DocQ3 } from '@/components/document/sections/DocQ3'
import { DocInvestigatorView } from '@/components/document/sections/DocInvestigatorView'
import { DocAnalysis } from '@/components/document/sections/DocAnalysis'
import { DocDataPrivacy } from '@/components/document/sections/DocDataPrivacy'
import { DocLegalFramework } from '@/components/document/sections/DocLegalFramework'
import styles from './DocumentPage.module.css'

export function DocumentPage() {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
      <DocSidebar />

      <main className={styles.content}>
        <div className={styles.hero}>
          <div className={styles.heroLabel}>Product Overview — April 2026</div>
          <h1 className={styles.heroTitle}>ClearPath</h1>
          <p className={styles.heroDesc}>
            An AI-assisted workplace misconduct reporting platform built for 3M — designed to help reporters
            say more, and help investigators act faster.
          </p>
        </div>

        <DocIntroduction />
        <DocWhoItServes />
        <DocTheProblem />
        <DocHowFormWorks />
        <DocIntelligenceLayer />
        <DocQ1 />
        <DocQ2 />
        <DocQ3 />
        <DocInvestigatorView />
        <DocAnalysis />
        <DocDataPrivacy />
        <DocLegalFramework />

      </main>
      </div>
    </div>
  )
}
