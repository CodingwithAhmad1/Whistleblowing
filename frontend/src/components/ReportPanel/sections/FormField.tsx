import styles from './SharedField.module.css'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea'
  helperText?: string
  rows?: number
}

export function FormField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  helperText,
  rows,
}: FormFieldProps) {
  if (type === 'textarea') {
    return (
      <div className={styles.field}>
        {label ? (
          <label className={styles.label}>
            {label}
          </label>
        ) : null}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.textarea}
          rows={rows ?? 4}
          aria-label={label || 'Text area'}
        />
        {helperText ? <p className={styles.helperText}>{helperText}</p> : null}
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
        aria-label={label}
      />
    </div>
  )
}
