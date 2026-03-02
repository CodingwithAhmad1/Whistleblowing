import { useCallback, useEffect, useId, useRef, useState } from 'react'
import styles from './SearchableSelect.module.css'

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  ariaLabel?: string
  hideLabel?: boolean
  compact?: boolean
  /** When true, input is read-only—selection only, no typing */
  selectOnly?: boolean
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Type to search...',
  ariaLabel,
  hideLabel = false,
  compact = false,
  selectOnly = false,
}: SearchableSelectProps) {
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filteredOptions = selectOnly
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(inputValue.toLowerCase())
      )

  useEffect(() => {
    const opt = options.find((o) => o.value === value || o.label === value)
    setInputValue(opt ? opt.label : value)
  }, [value, options])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [inputValue])

  useEffect(() => {
    if (!isOpen) return
    const el = listRef.current
    if (!el) return
    const highlighted = el.querySelector(`[data-index="${highlightedIndex}"]`)
    highlighted?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, isOpen, filteredOptions.length])

  const selectOption = useCallback(
    (opt: SearchableSelectOption) => {
      onChange(opt.value)
      setInputValue(opt.label)
      setIsOpen(false)
      setTimeout(() => inputRef.current?.blur(), 0)
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectOnly) return
    const v = e.target.value
    setInputValue(v)
    setIsOpen(true)
    const match = options.find((o) => o.label === v)
    if (match) {
      onChange(match.value)
      setIsOpen(false)
      setTimeout(() => inputRef.current?.blur(), 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) =>
          i < filteredOptions.length - 1 ? i + 1 : i
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => (i > 0 ? i - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        const opt = options.find((o) => o.value === value || o.label === value)
        setInputValue(opt ? opt.label : value)
        setTimeout(() => inputRef.current?.blur(), 0)
        break
      default:
        break
    }
  }

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 150)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsOpen(true)
    const el = e.target
    setTimeout(() => {
      el.setSelectionRange(el.value.length, el.value.length)
    }, 0)
  }

  return (
    <div className={`${styles.field} ${compact ? styles.compact : ''}`}>
      {!hideLabel && (
        <label className={styles.label} htmlFor={ariaLabel || label}>
          {label}
        </label>
      )}
      <div className={styles.combobox}>
        <input
          ref={inputRef}
          id={ariaLabel || label}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={selectOnly}
          className={compact ? `${styles.input} ${styles.inputCompact}` : styles.input}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete={selectOnly ? 'none' : 'list'}
          aria-controls={listId}
          aria-label={ariaLabel || label}
        />
        {isOpen && (
          <ul
            ref={listRef}
            id={listId}
            className={styles.list}
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <li className={styles.noResults}>No matches</li>
            ) : (
              filteredOptions.map((opt, idx) => (
                <li
                  key={opt.value}
                  data-index={idx}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  className={
                    idx === highlightedIndex
                      ? `${styles.option} ${styles.optionHighlighted}`
                      : styles.option
                  }
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectOption(opt)
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
