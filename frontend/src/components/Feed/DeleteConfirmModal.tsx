import { useEffect } from 'react'
import styles from './DeleteConfirmModal.module.css'

interface Props {
  submissionId: number
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmModal({ submissionId, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className={styles.card}>
        <h2 id="delete-modal-title" className={styles.title}>
          Delete report #{submissionId}?
        </h2>
        <p className={styles.body}>
          This action cannot be undone.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.deleteBtn} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
