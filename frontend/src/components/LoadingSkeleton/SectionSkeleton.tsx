import styles from './LoadingSkeleton.module.css'

export function SectionSkeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.header}>
        <div className={styles.title}></div>
      </div>
      <div className={styles.content}>
        <div className={styles.field}></div>
        <div className={styles.field}></div>
        <div className={styles.fieldShort}></div>
      </div>
    </div>
  )
}
