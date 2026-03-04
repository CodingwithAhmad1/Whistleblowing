/** Option shape used by SearchableSelect and similar components. */
export interface OptionLike {
  value: string
  label: string
}

/**
 * Find option by value or label match.
 * Used when syncing displayed value from stored value (e.g. after load or Escape).
 */
export function findOptionByValue(
  value: string,
  options: OptionLike[]
): OptionLike | undefined {
  return options.find((o) => o.value === value || o.label === value)
}
