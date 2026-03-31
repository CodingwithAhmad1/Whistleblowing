/**
 * Report schema: single source of truth for PDF layout.
 * To add a new field: add to ReportData + add entry here.
 */

import type { ReportData } from '@/types/report'

export interface SectionDef {
  id: string
  title: string
}

export interface FieldDef {
  key: string
  label: string
  section: string
  hideWhen?: (report: ReportData) => boolean
  formatValue?: (val: string) => string
}

const YES_NO_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
}

const MANAGEMENT_LABELS: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  do_not_know: 'Do Not Know / Do Not Wish To Disclose',
  do_not_wish: 'Do Not Wish To Disclose',
}

const HOW_AWARE_LABELS: Record<string, string> = {
  it_happened_to_me: 'It happened to me',
  i_observed_it: 'I observed it',
  i_heard_it: 'I heard it',
  told_by_coworker: 'Told to me by a co-worker',
  told_by_outside: 'Told to me by someone outside the company',
  overheard_it: 'Overheard it',
  accidentally_found_document: 'Accidentally found a document or file',
  other: 'Other',
}

const DURATION_LABELS: Record<string, string> = {
  once: 'Once',
  one_week: 'One week',
  '1_to_3_months': '1 to 3 months',
  '3_months_to_a_year': '3 months to a year',
  more_than_a_year: 'More than a year',
  don_t_know: "Don't know",
}

/** Convert label map to { value, label }[] for form selects. */
function labelsToOptions(labels: Record<string, string>): { value: string; label: string }[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

/** Form options - single source of truth for UI and PDF labels. */
export const YES_NO_OPTIONS = labelsToOptions(YES_NO_LABELS)
export const SUPERVISOR_MANAGEMENT_OPTIONS = labelsToOptions(MANAGEMENT_LABELS)
export const HOW_AWARE_OPTIONS = labelsToOptions(HOW_AWARE_LABELS)
export const DURATION_OPTIONS = labelsToOptions(DURATION_LABELS)

export const REPORT_SECTIONS: SectionDef[] = [
  { id: 'organization', title: 'Organization & Context' },
  { id: 'reporter', title: 'Reporter Preferences' },
  { id: 'persons', title: 'Identifying Persons and Management' },
  { id: 'incident', title: 'Incident Details' },
]

export const REPORT_FIELDS: FieldDef[] = [
  // Organization & Context
  { key: 'organization_tier', label: 'Organization / Tier', section: 'organization' },
  { key: 'country', label: 'Country', section: 'organization' },
  { key: 'incident_location', label: 'Location where incident occurred', section: 'organization' },
  // Reporter Preferences
  {
    key: 'is_employee',
    label: 'Are you an employee of the organization?',
    section: 'reporter',
    formatValue: (v) => YES_NO_LABELS[v] ?? v,
  },
  {
    key: 'wish_anonymous',
    label: 'Do you wish to remain ANONYMOUS for this report?',
    section: 'reporter',
    formatValue: (v) => YES_NO_LABELS[v] ?? v,
  },
  {
    key: 'reporter_first_name',
    label: 'First Name',
    section: 'reporter',
    hideWhen: (r) => r.wish_anonymous !== 'no',
  },
  {
    key: 'reporter_last_name',
    label: 'Last Name',
    section: 'reporter',
    hideWhen: (r) => r.wish_anonymous !== 'no',
  },
  {
    key: 'reporter_phone',
    label: 'Your Phone Number',
    section: 'reporter',
    hideWhen: (r) => r.wish_anonymous !== 'no',
  },
  {
    key: 'reporter_email',
    label: 'Your Email Address',
    section: 'reporter',
    hideWhen: (r) => r.wish_anonymous !== 'no',
  },
  {
    key: 'best_time_contact',
    label: 'Best time for communication with you',
    section: 'reporter',
    hideWhen: (r) => r.wish_anonymous !== 'no',
  },
  // Identifying Persons and Management - person fields handled specially in generator
  {
    key: 'supervisor_involved',
    label: 'Do you suspect or know that a supervisor or management is involved?',
    section: 'persons',
    formatValue: (v) => MANAGEMENT_LABELS[v] ?? v,
  },
  {
    key: 'supervisor_who',
    label: 'If yes, then who?',
    section: 'persons',
    hideWhen: (r) => r.supervisor_involved !== 'yes',
  },
  {
    key: 'management_aware',
    label: 'Is management aware of this problem?',
    section: 'persons',
    formatValue: (v) => MANAGEMENT_LABELS[v] ?? v,
  },
  // Incident Details
  { key: 'general_nature', label: 'General nature of matter', section: 'incident' },
  { key: 'where_occurred', label: 'Where did it occur?', section: 'incident' },
  { key: 'when_occurred', label: 'When did it occur?', section: 'incident' },
  {
    key: 'duration',
    label: 'How long do you think this problem has been going on?',
    section: 'incident',
    formatValue: (v) => DURATION_LABELS[v] ?? v,
  },
  {
    key: 'how_aware',
    label: 'How did you become aware of this violation?',
    section: 'incident',
    formatValue: (v) => HOW_AWARE_LABELS[v] ?? v,
  },
  { key: 'how_aware_other', label: 'If other, how?', section: 'incident' },
  {
    key: 'full_details_q1',
    label: 'Please describe what happened in your own words.',
    section: 'incident',
  },
  // full_details_q2, full_details_q3, full_details_q2_question, full_details_q3_question
  // are rendered as a special Q&A block in the PDF generator — excluded from standard iteration.
]
