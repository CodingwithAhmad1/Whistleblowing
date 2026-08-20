import type {
  Layer1Extraction,
  FollowUpQuestion,
  ExtractionBreakdown,
  CoverageSnapshot,
} from '@/utils/feedStore'
import type { ReportData } from '@/types/report'
import styles from './SummaryView.module.css'

interface Props {
  extraction: Layer1Extraction | null
  /** When present, shows algorithmic vs model slices; optional for legacy rows. */
  extractionBreakdown?: ExtractionBreakdown | null
  followUpQuestions: FollowUpQuestion[]
  /** Dual-corpus coverage snapshot; optional for legacy rows. */
  coverage?: CoverageSnapshot | null
  formData: ReportData
}

const COVERAGE_LABELS: Record<string, string> = {
  covered: 'Covered by policy & law',
  legal_only: 'Legal only — policy gap',
  policy_only: 'Policy only — exceeds statutory floor',
  uncovered: 'Uncovered by both corpora',
}

function BooleanBadges({ extraction }: { extraction: Layer1Extraction }) {
  const rows: [string, boolean][] = [
    ['Specific Examples Present', extraction.specific_examples_present],
    ['Evidence Described', extraction.evidence_described],
    ['Timeline Clear', extraction.timeline_clear],
    ['Witnesses Mentioned', extraction.witnesses_mentioned],
    ['Prior Reporting Mentioned', extraction.prior_reporting_mentioned],
    ['Impact Described', extraction.impact_described],
    ['Retaliation Mentioned', extraction.retaliation_mentioned],
  ]
  return (
    <div className={styles.card}>
      <div className={styles.badgeRow}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.badgeRowItem}>
            <span className={styles.badgeLabel}>{label}</span>
            <span className={value ? styles.badgeTrue : styles.badgeFalse}>
              {value ? 'Yes' : 'No'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegacyExtractionView({ extraction }: { extraction: Layer1Extraction }) {
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>AI Summary</div>
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
      </div>
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
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Report Characteristics</div>
        <BooleanBadges extraction={extraction} />
      </div>
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
  )
}

function BreakdownView({
  extraction,
  breakdown,
}: {
  extraction: Layer1Extraction
  breakdown: ExtractionBreakdown
}) {
  const a = breakdown.from_answers
  const m = breakdown.from_model
  return (
    <>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>How to read this</div>
        <p className={styles.mergeNote}>
          <strong>From your answers</strong> is derived only from structured fields (rules).{' '}
          <strong>From your narrative (AI)</strong> reflects the model on your story before form merge.{' '}
          The <strong>merged summary</strong> and <strong>final combined</strong> indicators are what
          follow-up gap detection uses, together with your answers.
        </p>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Merged summary (operational)</div>
        <div className={styles.card}>
          <div className={styles.cardInner}>
            <p className={styles.summaryText}>
              {extraction.summary || 'No summary available.'}
            </p>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>From your answers (rules)</div>
        <div className={styles.card}>
          <div className={styles.entityRow}>
            <div className={styles.entityItem}>
              <span className={styles.entityLabel}>Dates</span>
              <span className={styles.entityValues}>
                {a.dates_mentioned.length > 0
                  ? a.dates_mentioned.join(', ')
                  : <span className={styles.tagNone}>None</span>}
              </span>
            </div>
            <div className={styles.entityItem}>
              <span className={styles.entityLabel}>People</span>
              <span className={styles.entityValues}>
                {a.people_mentioned.length > 0
                  ? a.people_mentioned.join(', ')
                  : <span className={styles.tagNone}>None</span>}
              </span>
            </div>
            <div className={styles.entityItem}>
              <span className={styles.entityLabel}>Locations</span>
              <span className={styles.entityValues}>
                {a.locations_mentioned.length > 0
                  ? a.locations_mentioned.join(', ')
                  : <span className={styles.tagNone}>None</span>}
              </span>
            </div>
          </div>
        </div>
        <div className={styles.card} style={{ marginTop: 'var(--space-12)' }}>
          <div className={styles.badgeRow}>
            {([
              ['Specific examples (from form / sequence length)', a.specific_examples_present],
              ['Evidence described (from form)', a.evidence_described],
              ['Timeline clear (from form)', a.timeline_clear],
              ['Prior reporting (management aware)', a.prior_reporting_mentioned],
            ] as const).map(([label, value]) => (
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
      <div className={styles.section}>
        <div className={styles.sectionTitle}>From your narrative (AI)</div>
        {m.used_defaults && (
          <p className={styles.mergeNote}>
            Model output used a fallback because JSON parsing failed once; treat narrative fields with care.
          </p>
        )}
        <div className={styles.card}>
          <div className={styles.cardInner}>
            <p className={styles.summaryText}>
              {m.summary?.trim() || 'No model summary.'}
            </p>
          </div>
        </div>
        <div className={styles.section} style={{ marginTop: 'var(--space-12)' }}>
          <div className={styles.sectionTitle}>Allegation types (model)</div>
          <div className={styles.tagList}>
            {m.allegation_type.length > 0 ? (
              m.allegation_type.map((t, i) => (
                <span key={i} className={styles.tag}>{t}</span>
              ))
            ) : (
              <span className={styles.tagNone}>None identified</span>
            )}
          </div>
        </div>
        <div className={styles.card} style={{ marginTop: 'var(--space-12)' }}>
          <div className={styles.badgeRow}>
            {([
              ['Specific Examples Present', m.specific_examples_present],
              ['Evidence Described', m.evidence_described],
              ['Timeline Clear', m.timeline_clear],
              ['Witnesses Mentioned', m.witnesses_mentioned],
              ['Prior Reporting Mentioned', m.prior_reporting_mentioned],
              ['Impact Described', m.impact_described],
              ['Retaliation Mentioned', m.retaliation_mentioned],
            ] as const).map(([label, value]) => (
              <div key={label} className={styles.badgeRowItem}>
                <span className={styles.badgeLabel}>{label}</span>
                <span className={value ? styles.badgeTrue : styles.badgeFalse}>
                  {value ? 'Yes' : 'No'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card} style={{ marginTop: 'var(--space-12)' }}>
          <div className={styles.entityRow}>
            {([
              { label: 'Dates (model)', values: m.dates_mentioned },
              { label: 'People (model)', values: m.people_mentioned },
              { label: 'Locations (model)', values: m.locations_mentioned },
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
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Final combined (gap detection)</div>
        <p className={styles.mergeNote}>
          These merged indicators match the stored extraction used for follow-up questions.
        </p>
        <BooleanBadges extraction={extraction} />
        <div className={styles.card} style={{ marginTop: 'var(--space-12)' }}>
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
  )
}

export function SummaryView({ extraction, extractionBreakdown, followUpQuestions, coverage, formData }: Props) {
  const policyQuote = formData.policy_quote_matched?.trim()
  const policySection = formData.policy_section_matched?.trim()

  return (
    <div className={styles.container}>

      {extraction && extractionBreakdown ? (
        <BreakdownView extraction={extraction} breakdown={extractionBreakdown} />
      ) : extraction ? (
        <LegacyExtractionView extraction={extraction} />
      ) : (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>AI Summary</div>
          <p className={styles.noData}>Analysis data was not captured for this submission.</p>
        </div>
      )}

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

      {coverage && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Coverage</div>
          <div className={styles.card}>
            <div className={styles.cardInner}>
              <div className={styles.tagList}>
                <span className={`${styles.tag} ${styles[`coverage_${coverage.classification}`] ?? ''}`}>
                  {COVERAGE_LABELS[coverage.classification] ?? coverage.classification}
                </span>
              </div>
              {coverage.legal && (
                <blockquote className={styles.policyQuote}>
                  &ldquo;{coverage.legal.verbatim_text}&rdquo;
                  {coverage.legal.section && (
                    <span className={styles.policyCitation}>
                      — {coverage.legal.section} (legal corpus)
                    </span>
                  )}
                </blockquote>
              )}
              {coverage.legal?.interpretation && (
                <p className={styles.aiInterpretation}>
                  AI interpretation: {coverage.legal.interpretation}
                </p>
              )}
              {(coverage.absence_notices ?? []).map((notice) => (
                <p key={notice} className={styles.noMatch}>{notice}</p>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
