import styles from './SharedField.module.css'

interface FormFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'textarea'
  options?: { value: string; label: string }[]
  helperText?: string
  rows?: number
}

export function FormField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  options,
  helperText,
  rows,
}: FormFieldProps) {
  if (options) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.select}
          aria-label={label}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

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
