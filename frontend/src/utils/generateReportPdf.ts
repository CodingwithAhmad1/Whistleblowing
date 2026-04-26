/**
 * Client-side PDF generation for whistleblowing report.
 * Schema-driven for standard fields; Q1/Q2/Q3 rendered as a dedicated Q&A block.
 * Use `generateSubmissionPdf` (feed row / stored submission) as the public entry point.
 */

import { jsPDF } from 'jspdf'
import type { ReportData } from '@/types/report'
import { personsFromReport } from '@/types/report'
import { REPORT_SECTIONS, REPORT_FIELDS, type FieldDef } from '@/data/reportSchema'
import type { StoredSubmission } from '@/utils/feedStore'
import { submissionPdfFilename } from '@/utils/feedStore'

// ── Layout constants ──────────────────────────────────────────────────────────

const MARGIN = 20
const LINE_H = 6        // base line height (mm)
const SECTION_GAP = 10  // space after section block
const FIELD_GAP = 5     // space between fields
const W_NORMAL = 11
const W_HEADING = 13
const W_SMALL = 9
const TABLE_PAD = 2
const TABLE_ROW_H = 7

// ── Helpers ───────────────────────────────────────────────────────────────────

function pageW(doc: jsPDF) { return doc.internal.pageSize.width }
function contentW(doc: jsPDF) { return pageW(doc) - 2 * MARGIN }

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.height - MARGIN) {
    doc.addPage()
    return MARGIN + 4
  }
  return y
}

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text, maxW)
}

function isPersonKey(key: string): boolean {
  return /^person_\d+_(first|last|title)$/.test(key)
}

const CONTACT_KEYS = new Set([
  'reporter_first_name', 'reporter_last_name', 'reporter_phone',
  'reporter_phone_code', 'reporter_email', 'best_time_contact',
])

const FULL_DETAILS_KEYS = new Set([
  'full_details_q1', 'sequence_of_events', 'evidence_description',
  'full_details_q2', 'full_details_q3',
  'full_details_q2_question', 'full_details_gap2', 'full_details_gap2_question',
  'full_details_q3_question',
  'policy_quote_matched', 'policy_section_matched', 'constructed_sentence',
])

function getDisplay(report: ReportData, key: string, def: FieldDef): string {
  const raw = (report as unknown as Record<string, string>)[key] ?? ''
  const trimmed = raw.trim()
  if (!trimmed) return 'Not provided'
  return def.formatValue ? def.formatValue(trimmed) : trimmed
}

function shouldShow(report: ReportData, def: FieldDef): boolean {
  return !def.hideWhen?.(report)
}

// ── Section heading ───────────────────────────────────────────────────────────

function drawSectionHeading(doc: jsPDF, title: string, y: number): number {
  const cw = contentW(doc)
  y = ensureSpace(doc, y, LINE_H * 2 + 4)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(W_HEADING)
  doc.setTextColor(0, 0, 0)
  doc.text(title.toUpperCase(), MARGIN, y)
  y += LINE_H - 1

  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y, MARGIN + cw, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(W_NORMAL)
  return y
}

// ── Standard field ────────────────────────────────────────────────────────────

function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  dimIfEmpty = true,
): number {
  const cw = contentW(doc)
  const isBlank = value === 'Not provided'
  const valueLines = wrap(doc, value, cw - 6)
  const totalH = LINE_H + valueLines.length * LINE_H
  y = ensureSpace(doc, y, totalH + FIELD_GAP)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(W_NORMAL)
  doc.setTextColor(0, 0, 0)
  doc.text(label + ':', MARGIN, y)
  y += LINE_H

  doc.setFont('helvetica', 'normal')
  if (dimIfEmpty && isBlank) doc.setTextColor(160, 160, 160)
  for (const line of valueLines) {
    doc.text(line, MARGIN + 4, y)
    y += LINE_H
  }
  doc.setTextColor(0, 0, 0)
  y += FIELD_GAP
  return y
}

// ── Q&A block (for full details) ──────────────────────────────────────────────

function drawQA(
  doc: jsPDF,
  question: string,
  answer: string,
  y: number,
): number {
  const cw = contentW(doc)
  const isBlank = !answer.trim()

  // Question
  const qLines = wrap(doc, question, cw)
  y = ensureSpace(doc, y, qLines.length * LINE_H + 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(W_NORMAL)
  doc.setTextColor(0, 0, 0)
  for (const line of qLines) {
    doc.text(line, MARGIN, y)
    y += LINE_H
  }
  y += 2

  // Answer
  const aLines = wrap(doc, isBlank ? 'Not provided' : answer.trim(), cw - 6)
  y = ensureSpace(doc, y, aLines.length * LINE_H + FIELD_GAP)
  doc.setFont('helvetica', 'normal')
  if (isBlank) doc.setTextColor(160, 160, 160)
  for (const line of aLines) {
    doc.text(line, MARGIN + 4, y)
    y += LINE_H
  }
  doc.setTextColor(0, 0, 0)
  y += FIELD_GAP + 2
  return y
}

// ── Contact table ─────────────────────────────────────────────────────────────

function formatPhone(report: ReportData): string {
  const code = (report as unknown as Record<string, string>).reporter_phone_code ?? ''
  const num = report.reporter_phone?.trim() ?? ''
  if (!num) return 'Not provided'
  return code ? `${code} ${num}` : num
}

function drawContactTable(doc: jsPDF, report: ReportData, y: number): number {
  const cw = contentW(doc)
  const rows: [string, string][] = [
    ['First Name', report.reporter_first_name?.trim() || 'Not provided'],
    ['Last Name', report.reporter_last_name?.trim() || 'Not provided'],
    ['Phone', formatPhone(report)],
    ['Email', report.reporter_email?.trim() || 'Not provided'],
    ['Best time to contact', report.best_time_contact?.trim() || 'Not provided'],
  ]
  const labelW = cw * 0.35
  const valueW = cw * 0.65

  doc.setFontSize(W_SMALL)
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, MARGIN + cw, y)

  for (const [label, value] of rows) {
    const valueLines = wrap(doc, value, valueW - TABLE_PAD * 2)
    const rowH = Math.max(TABLE_ROW_H, valueLines.length * LINE_H + TABLE_PAD * 2)
    const cellY = y + LINE_H - 1 + TABLE_PAD

    const isBlank = value === 'Not provided'
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(label + ':', MARGIN + TABLE_PAD, cellY)

    doc.setFont('helvetica', 'normal')
    if (isBlank) doc.setTextColor(160, 160, 160)
    for (let i = 0; i < valueLines.length; i++) {
      doc.text(valueLines[i], MARGIN + labelW + TABLE_PAD, cellY + i * LINE_H)
    }
    doc.setTextColor(0, 0, 0)

    doc.setDrawColor(220, 220, 220)
    doc.line(MARGIN, y + rowH, MARGIN + cw, y + rowH)
    y += rowH
  }

  doc.setDrawColor(180, 180, 180)
  doc.line(MARGIN + labelW, y - rows.length * TABLE_ROW_H, MARGIN + labelW, y)
  doc.line(MARGIN + cw, y - rows.length * TABLE_ROW_H, MARGIN + cw, y)
  return y
}

// ── Persons table ─────────────────────────────────────────────────────────────

function drawPersonsTable(
  doc: jsPDF,
  persons: Array<{ first: string; last: string; title: string }>,
  y: number,
): number {
  if (persons.length === 0) return y
  const cw = contentW(doc)
  const cols = [cw * 0.07, cw * 0.28, cw * 0.28, cw * 0.37]
  const headers = ['#', 'First Name', 'Last Name', 'Title / Role']

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(W_SMALL)
  doc.setTextColor(0, 0, 0)

  // Header
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, MARGIN + cw, y)

  let x = MARGIN
  for (let c = 0; c < headers.length; c++) {
    doc.text(headers[c], x + TABLE_PAD, y + LINE_H - 1)
    x += cols[c]
  }
  y += TABLE_ROW_H
  doc.line(MARGIN, y, MARGIN + cw, y)

  // Vertical dividers for header
  let vx = MARGIN
  for (let c = 0; c < cols.length - 1; c++) {
    vx += cols[c]
    doc.line(vx, y - TABLE_ROW_H, vx, y)
  }
  y += 2

  doc.setFont('helvetica', 'normal')

  for (let i = 0; i < persons.length; i++) {
    const p = persons[i]
    const rowTop = y
    const cells = [
      wrap(doc, String(i + 1), cols[0] - TABLE_PAD * 2),
      wrap(doc, p.first || '—', cols[1] - TABLE_PAD * 2),
      wrap(doc, p.last || '—', cols[2] - TABLE_PAD * 2),
      wrap(doc, p.title || '—', cols[3] - TABLE_PAD * 2),
    ]
    const maxLines = Math.max(...cells.map((c) => c.length), 1)
    const rowH = LINE_H * maxLines + TABLE_PAD * 2
    const cellY = y + LINE_H - 1 + TABLE_PAD

    x = MARGIN
    for (let c = 0; c < cells.length; c++) {
      for (let L = 0; L < cells[c].length; L++) {
        doc.text(cells[c][L], x + TABLE_PAD, cellY + L * LINE_H)
      }
      x += cols[c]
    }

    y += rowH
    doc.setDrawColor(220, 220, 220)
    doc.line(MARGIN, y, MARGIN + cw, y)

    vx = MARGIN
    for (let c = 0; c < cols.length - 1; c++) {
      vx += cols[c]
      doc.line(vx, rowTop, vx, y)
    }
    y += 2
  }

  doc.setDrawColor(180, 180, 180)
  doc.line(MARGIN + cw, y - persons.length * (TABLE_ROW_H + 2) - TABLE_ROW_H, MARGIN + cw, y - 2)
  return y
}

function formatUtcForPdfHeader(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  )
}

// ── Report form body (all schema sections) ─────────────────────────────────

function appendReportFormSections(doc: jsPDF, y: number, report: ReportData): number {
  // ── Sections ──────────────────────────────────────────────────────────────
  for (const section of REPORT_SECTIONS) {
    y = ensureSpace(doc, y, LINE_H * 4)
    y = drawSectionHeading(doc, section.title, y)

    // ── Persons section ────────────────────────────────────────────────────
    if (section.id === 'persons') {
      const persons = personsFromReport(report as unknown as Record<string, string | undefined>)
      const filled = persons.filter((p) => p.first.trim() || p.last.trim() || p.title.trim())

      if (filled.length > 0) {
        y = ensureSpace(doc, y, 14 + filled.length * 10)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(W_NORMAL)
        doc.text('Person(s) involved:', MARGIN, y)
        y += LINE_H + 2
        y = drawPersonsTable(doc, filled, y)
        y += FIELD_GAP
      } else {
        y = drawField(doc, 'Person(s) involved', 'Not provided', y)
      }
    }

    // ── Reporter contact table ─────────────────────────────────────────────
    if (section.id === 'reporter' && report.wish_anonymous === 'no') {
      y = ensureSpace(doc, y, 60)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(W_NORMAL)
      doc.text('Contact Details:', MARGIN, y)
      y += LINE_H + 2
      y = drawContactTable(doc, report, y)
      y += FIELD_GAP
    }

    // ── Incident: Full Details Q&A block ───────────────────────────────────
    if (section.id === 'incident') {
      // Standard incident fields (excluding full_details Q&A keys)
      const standardFields = REPORT_FIELDS.filter(
        (f) =>
          f.section === 'incident' &&
          !FULL_DETAILS_KEYS.has(f.key) &&
          shouldShow(report, f),
      )
      for (const def of standardFields) {
        y = drawField(doc, def.label, getDisplay(report, def.key, def), y)
      }

      // Full Details sub-heading
      y = ensureSpace(doc, y, LINE_H * 3)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(W_NORMAL)
      doc.setTextColor(0, 0, 0)
      doc.text('Full Details', MARGIN, y)
      y += LINE_H - 1
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.3)
      doc.line(MARGIN, y, MARGIN + contentW(doc), y)
      y += 5

      // Q1 — narrative
      y = drawQA(
        doc,
        'Please describe what happened in your own words.',
        report.full_details_q1?.trim() ?? '',
        y,
      )

      // Q2 — standardised sequence of events
      const sequenceAnswer = (report as unknown as Record<string, string>).sequence_of_events?.trim() ?? ''
      if (sequenceAnswer) {
        y = drawQA(
          doc,
          'Sequence of events — what happened first and what happened next?',
          sequenceAnswer,
          y,
        )
      }

      // Q3 — standardised evidence description
      const sm = (report as unknown as Record<string, string>).has_supporting_materials
      const evidenceAnswer = (report as unknown as Record<string, string>).evidence_description?.trim() ?? ''
      if (evidenceAnswer && sm !== 'no') {
        y = drawQA(
          doc,
          'Supporting evidence or materials',
          evidenceAnswer,
          y,
        )
      }

      // Q4 — AI-generated follow-up (deterministic intake workflow)
      const q2Answer = report.full_details_q2?.trim() ?? ''
      const q2Question = report.full_details_q2_question?.trim()
      if (q2Question || q2Answer) {
        y = drawQA(
          doc,
          q2Question || 'Follow-up question',
          q2Answer,
          y,
        )
      }

      // Second AI gap follow-up (optional)
      const gap2Answer = report.full_details_gap2?.trim() ?? ''
      const gap2Question = report.full_details_gap2_question?.trim()
      if (gap2Question || gap2Answer) {
        y = drawQA(
          doc,
          gap2Question || 'Follow-up question',
          gap2Answer,
          y,
        )
      }

      // Policy-based follow-up question (if present)
      const q3Answer = report.full_details_q3?.trim() ?? ''
      const q3Question = report.full_details_q3_question?.trim()
      if (q3Question || q3Answer) {
        // Show matched policy quote if available
        const matchedQuote = report.policy_quote_matched?.trim()
        if (matchedQuote) {
          const quoteLines = wrap(doc, `"${matchedQuote}"`, contentW(doc) - 12)
          y = ensureSpace(doc, y, quoteLines.length * LINE_H + 6)
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(W_SMALL)
          doc.setTextColor(100, 100, 100)
          for (const line of quoteLines) {
            doc.text(line, MARGIN + 6, y)
            y += LINE_H
          }
          // Section citation below the quote
          const matchedSection = (report as unknown as Record<string, string>).policy_section_matched?.trim()
          if (matchedSection) {
            const citeLine = `— ${matchedSection}`
            doc.setFont('helvetica', 'italic')
            doc.setFontSize(W_SMALL - 1)
            doc.setTextColor(140, 140, 140)
            doc.text(citeLine, MARGIN + 6, y)
            y += LINE_H
          }
          doc.setTextColor(0, 0, 0)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(W_NORMAL)
          y += 3
        }
        y = drawQA(
          doc,
          q3Question || 'Do you believe this policy has been violated? If Yes, to what extent?',
          q3Answer,
          y,
        )
      }

      y += SECTION_GAP
      continue
    }

    // ── Standard fields for all other sections ─────────────────────────────
    const skipKeys = new Set([
      ...(section.id === 'reporter' && report.wish_anonymous === 'no'
        ? [...CONTACT_KEYS]
        : []),
    ])

    const fields = REPORT_FIELDS.filter(
      (f) =>
        f.section === section.id &&
        !isPersonKey(f.key) &&
        !FULL_DETAILS_KEYS.has(f.key) &&
        !skipKeys.has(f.key) &&
        shouldShow(report, f),
    )
    for (const def of fields) {
      y = drawField(doc, def.label, getDisplay(report, def.key, def), y)
    }

    y += SECTION_GAP
  }

  return y
}

// ── Summary / analysis (matches Feed “Summary” tab content) ─────────────────

function appendSummaryAndAnalysis(doc: jsPDF, y: number, submission: StoredSubmission): number {
  const { extraction, extractionBreakdown, followUpQuestions, formData } = submission
  const generatedQuestions = followUpQuestions.length > 0
    ? followUpQuestions.map((q) => q.question_text?.trim() ?? '').filter(Boolean)
    : [
        formData.full_details_q2_question?.trim() ?? '',
        formData.full_details_gap2_question?.trim() ?? '',
        formData.full_details_q3_question?.trim() ?? '',
      ].filter(Boolean)

  y = ensureSpace(doc, y, LINE_H * 4)
  y = drawSectionHeading(doc, 'AI Summary & Extraction', y)

  if (!extraction) {
    y = drawField(doc, 'AI analysis', 'Analysis data was not captured for this submission.', y, false)
  } else if (extractionBreakdown) {
    const a = extractionBreakdown.from_answers
    const m = extractionBreakdown.from_model
    y = drawField(
      doc,
      'Merged summary (operational)',
      extraction.summary?.trim() || 'No summary text.',
      y,
      false,
    )
    y = drawSectionHeading(doc, 'From your answers (rules)', y)
    y = drawField(
      doc,
      'Dates',
      a.dates_mentioned.length > 0 ? a.dates_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'People',
      a.people_mentioned.length > 0 ? a.people_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'Locations',
      a.locations_mentioned.length > 0 ? a.locations_mentioned.join(', ') : 'None',
      y,
      false,
    )
    for (const [label, val] of [
      ['Specific examples (form / sequence)', a.specific_examples_present],
      ['Evidence described (form)', a.evidence_described],
      ['Timeline clear (form)', a.timeline_clear],
      ['Prior reporting (management aware)', a.prior_reporting_mentioned],
    ] as [string, boolean][]) {
      y = drawField(doc, label, val ? 'Yes' : 'No', y, false)
    }
    y = drawSectionHeading(doc, 'From your narrative (AI)', y)
    if (m.used_defaults) {
      y = drawField(doc, 'Note', 'Model used fallback JSON for this layer.', y, false)
    }
    y = drawField(doc, 'Model summary', m.summary?.trim() || 'No model summary.', y, false)
    const modelTags = m.allegation_type.length > 0 ? m.allegation_type.join(', ') : 'None identified'
    y = drawField(doc, 'Allegation types (model)', modelTags, y, false)
    for (const [label, val] of [
      ['Specific examples present', m.specific_examples_present],
      ['Evidence described', m.evidence_described],
      ['Timeline clear', m.timeline_clear],
      ['Witnesses mentioned', m.witnesses_mentioned],
      ['Prior reporting mentioned', m.prior_reporting_mentioned],
      ['Impact described', m.impact_described],
      ['Retaliation mentioned', m.retaliation_mentioned],
    ] as [string, boolean][]) {
      y = drawField(doc, label, val ? 'Yes' : 'No', y, false)
    }
    y = drawField(
      doc,
      'Dates (model)',
      m.dates_mentioned.length > 0 ? m.dates_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'People (model)',
      m.people_mentioned.length > 0 ? m.people_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'Locations (model)',
      m.locations_mentioned.length > 0 ? m.locations_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawSectionHeading(doc, 'Final combined (gap detection)', y)
    for (const [label, val] of [
      ['Specific examples present', extraction.specific_examples_present],
      ['Evidence described', extraction.evidence_described],
      ['Timeline clear', extraction.timeline_clear],
      ['Witnesses mentioned', extraction.witnesses_mentioned],
      ['Prior reporting mentioned', extraction.prior_reporting_mentioned],
      ['Impact described', extraction.impact_described],
      ['Retaliation mentioned', extraction.retaliation_mentioned],
    ] as [string, boolean][]) {
      y = drawField(doc, label, val ? 'Yes' : 'No', y, false)
    }
    y = drawField(
      doc,
      'Dates (merged)',
      extraction.dates_mentioned.length > 0 ? extraction.dates_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'People (merged)',
      extraction.people_mentioned.length > 0 ? extraction.people_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'Locations (merged)',
      extraction.locations_mentioned.length > 0 ? extraction.locations_mentioned.join(', ') : 'None',
      y,
      false,
    )
  } else {
    y = drawField(
      doc,
      'Summary',
      extraction.summary?.trim() || 'No summary text.',
      y,
      false,
    )

    const tags = extraction.allegation_type.length > 0
      ? extraction.allegation_type.join(', ')
      : 'None identified'
    y = drawField(doc, 'Allegation types', tags, y, false)

    const characteristics: [string, boolean][] = [
      ['Specific examples present', extraction.specific_examples_present],
      ['Evidence described', extraction.evidence_described],
      ['Timeline clear', extraction.timeline_clear],
      ['Witnesses mentioned', extraction.witnesses_mentioned],
      ['Prior reporting mentioned', extraction.prior_reporting_mentioned],
      ['Impact described', extraction.impact_described],
      ['Retaliation mentioned', extraction.retaliation_mentioned],
    ]
    for (const [label, val] of characteristics) {
      y = drawField(doc, label, val ? 'Yes' : 'No', y, false)
    }

    y = drawField(
      doc,
      'Dates mentioned',
      extraction.dates_mentioned.length > 0 ? extraction.dates_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'People mentioned',
      extraction.people_mentioned.length > 0 ? extraction.people_mentioned.join(', ') : 'None',
      y,
      false,
    )
    y = drawField(
      doc,
      'Locations mentioned',
      extraction.locations_mentioned.length > 0 ? extraction.locations_mentioned.join(', ') : 'None',
      y,
      false,
    )
  }

  if (formData.constructed_sentence?.trim()) {
    y = drawField(
      doc,
      'AI-generated case summary',
      formData.constructed_sentence.trim(),
      y,
      false,
    )
  }

  y = ensureSpace(doc, y, LINE_H * 4)
  y = drawSectionHeading(doc, 'Follow-Up Questions (generated)', y)

  if (generatedQuestions.length === 0) {
    y = drawField(doc, 'Questions', 'No follow-up questions were generated for this submission.', y, false)
  } else {
    for (let i = 0; i < generatedQuestions.length; i++) {
      y = drawQA(doc, `Question ${i + 1}`, generatedQuestions[i], y)
    }
  }

  y = ensureSpace(doc, y, LINE_H * 4)
  y = drawSectionHeading(doc, 'Policy Match (summary)', y)

  const policyQuote = formData.policy_quote_matched?.trim() ?? ''
  const policySection = formData.policy_section_matched?.trim() ?? ''
  if (!policyQuote) {
    y = drawField(doc, 'Policy', 'No policy match found', y, false)
  } else {
    const quoteLines = wrap(doc, `"${policyQuote}"`, contentW(doc) - 12)
    y = ensureSpace(doc, y, quoteLines.length * LINE_H + 8)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(W_SMALL)
    doc.setTextColor(100, 100, 100)
    for (const line of quoteLines) {
      doc.text(line, MARGIN + 4, y)
      y += LINE_H
    }
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(W_NORMAL)
    if (policySection) {
      doc.setFontSize(W_SMALL - 1)
      doc.setTextColor(140, 140, 140)
      y = ensureSpace(doc, y, LINE_H + 2)
      doc.text(`— ${policySection}`, MARGIN + 4, y)
      y += LINE_H
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(W_NORMAL)
    }
    y += FIELD_GAP
  }

  return y
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Full PDF: report form content (Report tab) plus analysis/summary blocks (Summary tab).
 */
export function generateSubmissionPdf(submission: StoredSubmission): void {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  let y = MARGIN
  const report = submission.formData

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(0, 0, 0)
  doc.text('Whistleblowing Report', MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(W_SMALL)
  doc.setTextColor(120, 120, 120)
  const generatedStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  doc.text(
    `Submission #${submission.id}  ·  Submitted ${formatUtcForPdfHeader(submission.timestamp)}`,
    MARGIN,
    y,
  )
  y += LINE_H - 1
  doc.text(`Confidential  ·  Generated ${generatedStr}`, MARGIN, y)
  y += 5

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y, MARGIN + contentW(doc), y)
  doc.setTextColor(0, 0, 0)
  y += SECTION_GAP

  y = appendReportFormSections(doc, y, report)
  y = appendSummaryAndAnalysis(doc, y, submission)

  doc.save(submissionPdfFilename(submission))
}
