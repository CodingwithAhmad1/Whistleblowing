export interface CountryOption {
  value: string
  label: string
}

let cached: CountryOption[] | null = null

/** Lazy-loads countries-list and returns sorted options (cached after first load) */
export async function getCountryListAsync(): Promise<CountryOption[]> {
  if (cached) return cached
  const { countries } = await import('countries-list')
  cached = Object.entries(countries)
    .map(([, data]) => ({ value: data.name, label: data.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
  return cached
}
