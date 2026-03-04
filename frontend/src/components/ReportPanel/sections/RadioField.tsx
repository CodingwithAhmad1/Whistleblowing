import type { OptionLike } from '@/utils/options'
import styles from './RadioField.module.css'

interface RadioFieldProps {
  name: string
  value: string
  options: OptionLike[]
  onChange: (value: string) => void
  question: string
  /** 'row' for side-by-side (e.g. Yes/No), 'column' for stacked (long labels). */
  layout?: 'row' | 'column'
}

export function RadioField({
  name,
  value,
  options,
  onChange,
  question,
  layout = 'row',
}: RadioFieldProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.question}>
        <span className={styles.questionText}>{question}</span>
      </div>
      <div className={layout === 'column' ? styles.radioColumn : styles.radioRow}>
        {options.map((opt) => (
          <label key={opt.value} className={styles.radioLabel}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className={styles.radio}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
