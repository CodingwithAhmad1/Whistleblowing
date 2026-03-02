export interface PhoneCodeOption {
  value: string
  label: string
}

let cached: PhoneCodeOption[] | null = null

/** Lazy-loads unique country calling codes (PIN only, e.g. "+1", "+44"). Cached after first load. */
export async function getPhoneCodeListAsync(): Promise<PhoneCodeOption[]> {
  if (cached) return cached
  const { countries } = await import('countries-list')
  const seen = new Set<string>()
  const options: PhoneCodeOption[] = []
  for (const [, data] of Object.entries(countries as Record<string, { name: string; phone: number[] }>)) {
    const codes = data.phone || []
    for (const code of codes) {
      const value = `+${code}`
      if (!seen.has(value)) {
        seen.add(value)
        options.push({ value, label: value })
      }
    }
  }
  options.sort((a, b) => {
    const aNum = parseInt(a.value.slice(1), 10)
    const bNum = parseInt(b.value.slice(1), 10)
    return aNum - bNum
  })
  cached = options
  return options
}

/** Returns phone code (e.g. "+1") for a country name, or null if no match. */
export function getPhoneCodeForCountry(countryName: string): Promise<string | null> {
  const trimmed = countryName?.trim()
  if (!trimmed) return Promise.resolve(null)
  return import('countries-list').then(({ countries }) => {
    const entry = Object.entries(countries as Record<string, { name: string; phone: number[] }>).find(
      ([, data]) => data.name === trimmed
    )
    if (!entry) return null
    const codes = entry[1].phone || []
    return codes.length > 0 ? `+${codes[0]}` : null
  })
}
