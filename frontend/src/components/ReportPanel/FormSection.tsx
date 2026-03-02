import type { ReactNode } from 'react'
import styles from './FormSection.module.css'

interface FormSectionProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function FormSection({ title, subtitle, children }: FormSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <div className={styles.fields}>{children}</div>
    </section>
  )
}
