import { useEffect, useState } from 'react'
import { useReport } from '@/context/ReportContext'
import { FormField } from './FormField'
import { SearchableSelect } from './SearchableSelect'
import { getCountryListAsync, type CountryOption } from '@/data/countries'

export function OrganizationContext() {
  const { report, updateReport } = useReport()
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])

  useEffect(() => {
    getCountryListAsync().then(setCountryOptions)
  }, [])

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
      />
      <SearchableSelect
        label="Location where incident occurred"
        value={report.incident_location}
        onChange={(v) => updateReport({ incident_location: v })}
        options={countryOptions}
        placeholder="Type to search countries..."
      />
    </>
  )
}
