import type { ReportData } from '@/types/report'

/** Text sent as primary intake / analysis narrative when the dedicated long-form Q1 is empty. */
export function buildAnalysisText(report: ReportData): string {
  if (report.full_details_q1?.trim()) return report.full_details_q1.trim()
  const parts = [
    report.general_nature && `Chronological incident account: ${report.general_nature}`,
    report.where_occurred && `Location: ${report.where_occurred}`,
    report.when_occurred && `When: ${report.when_occurred}`,
    report.how_aware && `How became aware: ${report.how_aware}`,
  ].filter(Boolean)
  return parts.join('. ') || 'No incident details provided.'
}
