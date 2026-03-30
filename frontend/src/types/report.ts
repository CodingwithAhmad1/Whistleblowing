/** Report structure aligned with backend Pydantic models */

export type YesNo = 'yes' | 'no'
export type ManagementAware = 'yes' | 'no' | 'do_not_know' | 'do_not_wish'

export interface PersonRecord {
  first: string
  last: string
  title: string
}

const PERSON_KEYS = [
  'person_1', 'person_2', 'person_3', 'person_4', 'person_5',
  'person_6', 'person_7', 'person_8', 'person_9', 'person_10',
] as const

export function personsFromReport(report: ReportData | Record<string, string | undefined>): PersonRecord[] {
  const persons: PersonRecord[] = []
  for (const key of PERSON_KEYS) {
    const first = report[`${key}_first`] ?? ''
    const last = report[`${key}_last`] ?? ''
    const title = report[`${key}_title`] ?? ''
    persons.push({ first, last, title })
  }
  return persons
}

export function reportUpdatesFromPersons(persons: PersonRecord[]): Record<string, string> {
  const updates: Record<string, string> = {}
  for (let i = 0; i < Math.min(persons.length, PERSON_KEYS.length); i++) {
    const key = PERSON_KEYS[i]
    updates[`${key}_first`] = persons[i].first
    updates[`${key}_last`] = persons[i].last
    updates[`${key}_title`] = persons[i].title
  }
  for (let i = persons.length; i < PERSON_KEYS.length; i++) {
    const key = PERSON_KEYS[i]
    updates[`${key}_first`] = ''
    updates[`${key}_last`] = ''
    updates[`${key}_title`] = ''
  }
  return updates
}

export const MAX_PERSONS = PERSON_KEYS.length

export interface ReportData {
  organization_tier: string
  country: string
  incident_location: string
  is_employee: YesNo | ''
  wish_anonymous: YesNo | ''
  reporter_first_name: string
  reporter_last_name: string
  reporter_phone_code: string
  reporter_phone: string
  reporter_email: string
  best_time_contact: string
  person_1_first: string
  person_1_last: string
  person_1_title: string
  person_2_first: string
  person_2_last: string
  person_2_title: string
  person_3_first: string
  person_3_last: string
  person_3_title: string
  person_4_first: string
  person_4_last: string
  person_4_title: string
  person_5_first: string
  person_5_last: string
  person_5_title: string
  person_6_first: string
  person_6_last: string
  person_6_title: string
  person_7_first: string
  person_7_last: string
  person_7_title: string
  person_8_first: string
  person_8_last: string
  person_8_title: string
  person_9_first: string
  person_9_last: string
  person_9_title: string
  person_10_first: string
  person_10_last: string
  person_10_title: string
  supervisor_involved: 'yes' | 'no' | 'do_not_know' | 'do_not_wish' | ''
  supervisor_who: string
  management_aware: ManagementAware | ''
  general_nature: string
  where_occurred: string
  when_occurred: string
  duration: string
  how_aware: string
  how_aware_other: string
  full_details_q1: string
  full_details_q2: string
  full_details_q2_question: string   // 1st follow-up question text
  full_details_q3: string
  full_details_q3_question: string   // 2nd follow-up question text (if any)
  policy_quote_matched: string       // matched policy quote from RAG
  policy_section_matched: string     // section citation for matched policy quote
  constructed_sentence: string       // LLM-generated summary for RAG query
  persons_concealing: string
}

export const initialReportData: ReportData = {
  organization_tier: '',
  country: '',
  incident_location: '',
  is_employee: '',
  wish_anonymous: '',
  reporter_first_name: '',
  reporter_last_name: '',
  reporter_phone_code: '',
  reporter_phone: '',
  reporter_email: '',
  best_time_contact: '',
  person_1_first: '',
  person_1_last: '',
  person_1_title: '',
  person_2_first: '',
  person_2_last: '',
  person_2_title: '',
  person_3_first: '',
  person_3_last: '',
  person_3_title: '',
  person_4_first: '',
  person_4_last: '',
  person_4_title: '',
  person_5_first: '',
  person_5_last: '',
  person_5_title: '',
  person_6_first: '',
  person_6_last: '',
  person_6_title: '',
  person_7_first: '',
  person_7_last: '',
  person_7_title: '',
  person_8_first: '',
  person_8_last: '',
  person_8_title: '',
  person_9_first: '',
  person_9_last: '',
  person_9_title: '',
  person_10_first: '',
  person_10_last: '',
  person_10_title: '',
  supervisor_involved: '',
  supervisor_who: '',
  management_aware: '',
  general_nature: '',
  where_occurred: '',
  when_occurred: '',
  duration: '',
  how_aware: '',
  how_aware_other: '',
  full_details_q1: '',
  full_details_q2: '',
  full_details_q2_question: '',
  full_details_q3: '',
  full_details_q3_question: '',
  policy_quote_matched: '',
  policy_section_matched: '',
  constructed_sentence: '',
  persons_concealing: '',
}
