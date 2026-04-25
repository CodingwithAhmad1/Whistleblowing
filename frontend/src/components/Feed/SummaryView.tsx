import type { Layer1Extraction, FollowUpQuestion } from '@/utils/feedStore'
import type { ReportData } from '@/types/report'
import styles from './SummaryView.module.css'

interface Props {
  extraction: Layer1Extraction | null
  followUpQuestions: FollowUpQuestion[]
  formData: ReportData
}

export function SummaryView({ extraction, followUpQuestions, formData }: Props) {
  const policyQuote = formData.policy_quote_matched?.trim()
  const policySection = formData.policy_section_matched?.trim()

  return (
    <div className={styles.container}>

      {/* AI Summary */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>AI Summary</div>
        {extraction ? (
          <>
            <p className={styles.mergeNote}>
              The summary and the characteristics below combine automated extraction with information from the
              structured form, where the form adds dates, names, or context that the narrative alone may not
              have captured.
            </p>
            <div className={styles.card}>
              <div className={styles.cardInner}>
                <p className={styles.summaryText}>
                  {extraction.summary || 'No summary available.'}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.noData}>Analysis data was not captured for this submission.</p>
        )}
      </div>

      {extraction && (
        <>
          {/* Allegation Types */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Allegation Types</div>
            <div className={styles.tagList}>
              {extraction.allegation_type.length > 0 ? (
                extraction.allegation_type.map((t, i) => (
                  <span key={i} className={styles.tag}>{t}</span>
                ))
              ) : (
                <span className={styles.tagNone}>None identified</span>
              )}
            </div>
          </div>

          {/* Report Characteristics */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Report Characteristics</div>
            <div className={styles.card}>
              <div className={styles.badgeRow}>
                {([
                  { label: 'Specific Examples Present', value: extraction.specific_examples_present },
                  { label: 'Evidence Described', value: extraction.evidence_described },
                  { label: 'Timeline Clear', value: extraction.timeline_clear },
                  { label: 'Witnesses Mentioned', value: extraction.witnesses_mentioned },
                  { label: 'Prior Reporting Mentioned', value: extraction.prior_reporting_mentioned },
                  { label: 'Impact Described', value: extraction.impact_described },
                  { label: 'Retaliation Mentioned', value: extraction.retaliation_mentioned },
                ] as const).map(({ label, value }) => (
                  <div key={label} className={styles.badgeRowItem}>
                    <span className={styles.badgeLabel}>{label}</span>
                    <span className={value ? styles.badgeTrue : styles.badgeFalse}>
                      {value ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Extracted Entities */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Extracted Entities</div>
            <div className={styles.card}>
              <div className={styles.entityRow}>
                {([
                  { label: 'Dates', values: extraction.dates_mentioned },
                  { label: 'People', values: extraction.people_mentioned },
                  { label: 'Locations', values: extraction.locations_mentioned },
                ] as const).map(({ label, values }) => (
                  <div key={label} className={styles.entityItem}>
                    <span className={styles.entityLabel}>{label}</span>
                    <span className={styles.entityValues}>
                      {values.length > 0
                        ? values.join(', ')
                        : <span className={styles.tagNone}>None</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Follow-Up Questions */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Follow-Up Questions</div>
        <div className={styles.card}>
          {followUpQuestions.length > 0 ? (
            <ol className={styles.questionList}>
              {followUpQuestions.map((q, i) => (
                <li key={q.gap_id} className={styles.questionItem}>
                  <span className={styles.questionNum}>{i + 1}.</span>
                  <p className={styles.questionText}>{q.question_text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.noMatch}>No follow-up questions were generated for this submission.</p>
          )}
        </div>
      </div>

      {/* Policy Match */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Policy Match</div>
        <div className={styles.card}>
          {policyQuote ? (
            <div className={styles.cardInner}>
              <blockquote className={styles.policyQuote}>
                &ldquo;{policyQuote}&rdquo;
                {policySection && (
                  <span className={styles.policyCitation}>— {policySection}</span>
                )}
              </blockquote>
            </div>
          ) : (
            <p className={styles.noMatch}>No policy match found</p>
          )}
        </div>
      </div>

    </div>
  )
}
