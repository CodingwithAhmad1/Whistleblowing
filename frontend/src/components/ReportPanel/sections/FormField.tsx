import styles from './SharedField.module.css'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea'
  helperText?: string
  rows?: number
  /** Use compact height (no large min-height); pair with `rows` for short answers. */
  textareaCompact?: boolean
  textareaClassName?: string
}

export function FormField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  helperText,
  rows,
  textareaCompact,
  textareaClassName,
}: FormFieldProps) {
  if (type === 'textarea') {
    const textareaClass = [
      styles.textarea,
      textareaCompact ? styles.textareaCompact : '',
      textareaClassName ?? '',
    ]
      .filter(Boolean)
      .join(' ')
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
          className={textareaClass}
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
