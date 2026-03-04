import { useEffect, useRef, useState } from 'react'
import { getPhoneCodeListAsync, getPhoneCodeForCountry, type PhoneCodeOption } from '@/data/phoneCodes'
import { findOptionByValue } from '@/utils/options'
import { SearchableSelect } from './SearchableSelect'
import styles from './PhoneWithCodeInput.module.css'

interface PhoneWithCodeInputProps {
  label: string
  codeValue: string
  numberValue: string
  onCodeChange: (v: string) => void
  onNumberChange: (v: string) => void
  /** When set, auto-selects matching phone code for this country name. User can still edit. */
  country?: string
}

export function PhoneWithCodeInput({
  label,
  codeValue,
  numberValue,
  onCodeChange,
  onNumberChange,
  country,
}: PhoneWithCodeInputProps) {
  const [options, setOptions] = useState<PhoneCodeOption[]>([])
  const prevCountryRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    getPhoneCodeListAsync().then(setOptions)
  }, [])

  useEffect(() => {
    if (!country?.trim()) return
    if (prevCountryRef.current === country) return
    prevCountryRef.current = country
    getPhoneCodeForCountry(country).then((code) => {
      if (code) onCodeChange(code)
    })
  }, [country, onCodeChange])

  const displayCode = codeValue || ''

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={label}>
        {label}
      </label>
      <div className={styles.phoneRow}>
        <div className={styles.codeSelect}>
          <SearchableSelect
            label=""
            value={displayCode}
            onChange={(v) => {
              const opt = findOptionByValue(v, options)
              if (opt) onCodeChange(opt.value)
            }}
            options={options}
            placeholder="+xxx"
            ariaLabel={`${label} country code`}
            hideLabel
            compact
          />
        </div>
        <input
          id={label}
          type="tel"
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, '').slice(0, 15))}
          placeholder="Phone number"
          className={styles.numberInput}
          aria-label={`${label} number`}
        />
      </div>
    </div>
  )
}
