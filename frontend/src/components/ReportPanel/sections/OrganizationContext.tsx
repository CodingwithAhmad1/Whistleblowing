import { useCallback, useEffect, useRef, useState } from 'react'
import { useReport } from '@/context/ReportContext'
import { FormField } from './FormField'
import { SearchableSelect } from './SearchableSelect'
import { getCountryListAsync, type CountryOption } from '@/data/countries'

export function OrganizationContext() {
  const { report, updateReport } = useReport()
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const loadStartedRef = useRef(false)

  const startLoadingCountries = useCallback(() => {
    if (loadStartedRef.current) return
    loadStartedRef.current = true
    void getCountryListAsync().then(setCountryOptions)
  }, [])

  /** Defer country list so first paint is cheaper; also load on first field focus. */
  useEffect(() => {
    if (typeof requestIdleCallback !== 'function') {
      const t = window.setTimeout(() => startLoadingCountries(), 1800)
      return () => clearTimeout(t)
    }
    const id = requestIdleCallback(() => startLoadingCountries(), { timeout: 5000 })
    return () => cancelIdleCallback(id)
  }, [startLoadingCountries])

  return (
    <>
      <FormField
        label="Organization / Tier"
        value={report.organization_tier}
        onChange={(v) => updateReport({ organization_tier: v })}
      />
      <SearchableSelect
        label="Country"
        value={report.country}
        onChange={(v) => updateReport({ country: v })}
        options={countryOptions}
        placeholder="Type to search countries..."
        onComboboxFocus={startLoadingCountries}
      />
      <SearchableSelect
        label="Location where incident occurred"
        value={report.incident_location}
        onChange={(v) => updateReport({ incident_location: v })}
        options={countryOptions}
        placeholder="Type to search countries..."
        onComboboxFocus={startLoadingCountries}
      />
    </>
  )
}
