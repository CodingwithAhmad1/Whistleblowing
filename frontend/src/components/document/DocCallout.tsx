import styles from './DocCallout.module.css'

type CalloutVariant = 'blue' | 'teal' | 'amber'

interface DocCalloutProps {
  variant?: CalloutVariant
  children: React.ReactNode
}

export function DocCallout({ variant = 'blue', children }: DocCalloutProps) {
  return (
    <div className={`${styles.callout} ${styles[variant]}`}>
      {children}
    </div>
  )
}
