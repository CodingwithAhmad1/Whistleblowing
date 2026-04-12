/**
 * Client-side PDF generation for whistleblowing report.
 * Schema-driven for standard fields; Q1/Q2/Q3 rendered as a dedicated Q&A block.
 */

import { jsPDF } from 'jspdf'
import type { ReportData } from '@/types/report'
import { personsFromReport } from '@/types/report'
import { REPORT_SECTIONS, REPORT_FIELDS, type FieldDef } from '@/data/reportSchema'

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

// ── Main export ───────────────────────────────────────────────────────────────

export function generateReportPdf(report: ReportData): void {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  let y = MARGIN

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(0, 0, 0)
  doc.text('Whistleblowing Report', MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(W_SMALL)
  doc.setTextColor(120, 120, 120)
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  doc.text(`Confidential  ·  Generated ${dateStr}`, MARGIN, y)
  y += 5

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y, MARGIN + contentW(doc), y)
  doc.setTextColor(0, 0, 0)
  y += SECTION_GAP

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
      // Standard incident fields (excluding full_details and persons_concealing)
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
      const evidenceAnswer = (report as unknown as Record<string, string>).evidence_description?.trim() ?? ''
      if (evidenceAnswer) {
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

  doc.save(`whistleblowing-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
