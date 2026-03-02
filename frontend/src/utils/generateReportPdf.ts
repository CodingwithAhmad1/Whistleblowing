/**
 * Client-side PDF generation for whistleblowing report.
 * Schema-driven: add fields to reportSchema.ts to include in PDF.
 */

import { jsPDF } from 'jspdf'
import type { ReportData } from '@/types/report'
import { personsFromReport } from '@/types/report'
import {
  REPORT_SECTIONS,
  REPORT_FIELDS,
  type FieldDef,
} from '@/data/reportSchema'

const MARGIN = 20
const LINE_HEIGHT = 6
const SECTION_GAP = 10
const FIELD_GAP = 4
const FONT_SIZE_NORMAL = 11
const FONT_SIZE_HEADING = 14
const FONT_SIZE_SMALL = 9
const TABLE_PADDING = 2
const TABLE_ROW_HEIGHT = 7

function getDisplayValue(
  report: ReportData,
  key: string,
  def: FieldDef
): string {
  const raw = (report as unknown as Record<string, string>)[key] ?? ''
  const trimmed = String(raw).trim()
  if (!trimmed) return '(No response)'
  if (def.formatValue) return def.formatValue(trimmed)
  return trimmed
}

function shouldShowField(report: ReportData, def: FieldDef): boolean {
  if (def.hideWhen?.(report)) return false
  return true
}

function isPersonKey(key: string): boolean {
  return /^person_\d+_(first|last|title)$/.test(key)
}

function addPageIfNeeded(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.height
  const bottomMargin = 20
  if (y + needed > pageHeight - bottomMargin) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth)
}

const CONTACT_TABLE_KEYS = [
  'reporter_first_name',
  'reporter_last_name',
  'reporter_phone',
  'reporter_email',
  'best_time_contact',
] as const

function formatPhoneForPdf(report: ReportData): string {
  const code = (report as unknown as Record<string, string>).reporter_phone_code ?? ''
  const num = report.reporter_phone?.trim() ?? ''
  if (!num) return '(No response)'
  if (code) return `${code} ${num}`
  return num
}

function drawContactTable(
  doc: jsPDF,
  report: ReportData,
  startX: number,
  startY: number,
  tableWidth: number
): number {
  const rows: Array<[string, string]> = [
    ['First Name', report.reporter_first_name?.trim() || '—'],
    ['Last Name', report.reporter_last_name?.trim() || '—'],
    ['Phone', formatPhoneForPdf(report)],
    ['Email', report.reporter_email?.trim() || '—'],
    ['Best time for communication', report.best_time_contact?.trim() || '—'],
  ]

  const labelColW = tableWidth * 0.35
  const valueColW = tableWidth * 0.65

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_SIZE_SMALL)
  let y = startY

  doc.setDrawColor(0.5, 0.5, 0.5)
  doc.line(startX, startY, startX + tableWidth, startY)

  for (const [label, value] of rows) {
    const valueLines = wrapText(doc, value, valueColW - TABLE_PADDING * 2)
    const rowH = Math.max(TABLE_ROW_HEIGHT, valueLines.length * LINE_HEIGHT + TABLE_PADDING * 2)
    const cellY = y + LINE_HEIGHT - 1 + TABLE_PADDING

    doc.setFont('helvetica', 'bold')
    doc.text(label + ':', startX + TABLE_PADDING, cellY)
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < valueLines.length; i++) {
      doc.text(valueLines[i], startX + labelColW + TABLE_PADDING, cellY + i * LINE_HEIGHT)
    }

    doc.setDrawColor(0.85, 0.85, 0.85)
    doc.line(startX, y + rowH, startX + tableWidth, y + rowH)

    y += rowH
  }

  doc.setDrawColor(0.5, 0.5, 0.5)
  doc.line(startX + labelColW, startY, startX + labelColW, y)

  doc.line(startX + tableWidth, startY, startX + tableWidth, y)
  return y
}

function drawPersonsTable(
  doc: jsPDF,
  persons: Array<{ first: string; last: string; title: string }>,
  startX: number,
  startY: number,
  tableWidth: number
): number {
  if (persons.length === 0) return startY

  const colW = [
    tableWidth * 0.08,  // #
    tableWidth * 0.28,  // First Name
    tableWidth * 0.28,  // Last Name
    tableWidth * 0.36,  // Title
  ]
  const headers = ['#', 'First Name', 'Last Name', 'Title']

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(FONT_SIZE_SMALL)
  let y = startY
  let x = startX

  // Header row + top border
  doc.setDrawColor(0.5, 0.5, 0.5)
  doc.line(startX, startY, startX + tableWidth, startY)
  for (let c = 0; c < headers.length; c++) {
    doc.text(headers[c], x + TABLE_PADDING, y + LINE_HEIGHT - 1)
    if (c < headers.length - 1) {
      x += colW[c]
      doc.line(startX + x, startY, startX + x, y + TABLE_ROW_HEIGHT)
    } else {
      x += colW[c]
    }
  }
  y += TABLE_ROW_HEIGHT
  doc.line(startX, y, startX + tableWidth, y)
  // Vertical lines for header
  let vx = startX
  for (let c = 0; c < colW.length; c++) {
    vx += colW[c]
    if (c < colW.length - 1) doc.line(vx, startY, vx, y)
  }
  y += 2

  doc.setFont('helvetica', 'normal')

  for (let i = 0; i < persons.length; i++) {
    const rowTop = y
    const p = persons[i]
    const firstLines = wrapText(doc, p.first || '—', colW[1] - TABLE_PADDING * 2)
    const lastLines = wrapText(doc, p.last || '—', colW[2] - TABLE_PADDING * 2)
    const titleLines = wrapText(doc, p.title || '—', colW[3] - TABLE_PADDING * 2)
    const rowLines = Math.max(firstLines.length, lastLines.length, titleLines.length, 1)
    const rowH = LINE_HEIGHT * rowLines + TABLE_PADDING * 2
    const cellY = y + LINE_HEIGHT - 1 + TABLE_PADDING

    // Cell 0: #
    doc.text(String(i + 1), startX + TABLE_PADDING, cellY)
    // Cell 1: First Name
    x = startX + colW[0]
    for (let L = 0; L < firstLines.length; L++) {
      doc.text(firstLines[L], x + TABLE_PADDING, cellY + L * LINE_HEIGHT)
    }
    // Cell 2: Last Name
    x += colW[1]
    for (let L = 0; L < lastLines.length; L++) {
      doc.text(lastLines[L], x + TABLE_PADDING, cellY + L * LINE_HEIGHT)
    }
    // Cell 3: Title
    x += colW[2]
    for (let L = 0; L < titleLines.length; L++) {
      doc.text(titleLines[L], x + TABLE_PADDING, cellY + L * LINE_HEIGHT)
    }

    y += rowH
    doc.setDrawColor(0.85, 0.85, 0.85)
    doc.line(startX, y, startX + tableWidth, y)
    vx = startX
    for (let c = 0; c < colW.length; c++) {
      vx += colW[c]
      if (c < colW.length - 1) doc.line(vx, rowTop, vx, y)
    }
    y += 2
  }

  // Right border
  doc.setDrawColor(0.5, 0.5, 0.5)
  doc.line(startX + tableWidth, startY, startX + tableWidth, y - 2)

  return y
}

export function generateReportPdf(report: ReportData): void {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const pageWidth = doc.internal.pageSize.width
  const maxTextWidth = pageWidth - 2 * MARGIN
  let y = MARGIN

  // Title
  doc.setFontSize(FONT_SIZE_HEADING)
  doc.setFont('helvetica', 'bold')
  doc.text('Report - Whistleblowing Submission', MARGIN, y)
  y += LINE_HEIGHT + 2

  doc.setFontSize(FONT_SIZE_SMALL)
  doc.setFont('helvetica', 'normal')
  const generated = new Date().toISOString().slice(0, 10)
  doc.text(`Generated: ${generated}`, MARGIN, y)
  y += LINE_HEIGHT + SECTION_GAP

  for (const section of REPORT_SECTIONS) {
    y = addPageIfNeeded(doc, y, SECTION_GAP + LINE_HEIGHT * 3)
    doc.setFontSize(FONT_SIZE_HEADING)
    doc.setFont('helvetica', 'bold')
    doc.text(`--- ${section.title} ---`, MARGIN, y)
    y += LINE_HEIGHT + FIELD_GAP
    doc.setFontSize(FONT_SIZE_NORMAL)
    doc.setFont('helvetica', 'normal')

    if (section.id === 'persons') {
      const persons = personsFromReport(report as unknown as Record<string, string | undefined>)
      const filledPersons = persons.filter(
        (p) => p.first.trim() || p.last.trim() || p.title.trim()
      )
      if (filledPersons.length > 0) {
        const tableWidth = maxTextWidth
        const estimatedTableH = 12 + filledPersons.length * 12
        y = addPageIfNeeded(doc, y, estimatedTableH)
        doc.setFont('helvetica', 'bold')
        doc.text('Person(s) engaged in this behavior:', MARGIN, y)
        y += LINE_HEIGHT + FIELD_GAP
        doc.setFont('helvetica', 'normal')
        y = drawPersonsTable(doc, filledPersons, MARGIN, y, tableWidth)
        y += FIELD_GAP
      }
    }

    if (section.id === 'reporter' && report.wish_anonymous === 'no') {
      y = addPageIfNeeded(doc, y, 60)
      doc.setFont('helvetica', 'bold')
      doc.text('Contact Details:', MARGIN, y)
      y += LINE_HEIGHT + FIELD_GAP
      doc.setFont('helvetica', 'normal')
      y = drawContactTable(doc, report, MARGIN, y, maxTextWidth)
      y += FIELD_GAP
    }

    // Standard fields for this section (exclude contact fields when rendered as table)
    const isContactField = (key: string) => CONTACT_TABLE_KEYS.includes(key as (typeof CONTACT_TABLE_KEYS)[number])
    const sectionFields = REPORT_FIELDS.filter(
      (f) =>
        f.section === section.id &&
        !isPersonKey(f.key) &&
        shouldShowField(report, f) &&
        !(section.id === 'reporter' && report.wish_anonymous === 'no' && isContactField(f.key))
    )
    for (const def of sectionFields) {
      const value = getDisplayValue(report, def.key, def)
      const labelLine = `${def.label}:`
      const valueLines = wrapText(doc, value, maxTextWidth - 5)

      const totalH = LINE_HEIGHT + valueLines.length * LINE_HEIGHT
      y = addPageIfNeeded(doc, y, totalH + FIELD_GAP)

      doc.setFont('helvetica', 'bold')
      doc.text(labelLine, MARGIN, y)
      y += LINE_HEIGHT
      doc.setFont('helvetica', 'normal')
      for (const l of valueLines) {
        doc.text(l, MARGIN + 5, y)
        y += LINE_HEIGHT
      }
      y += FIELD_GAP
    }

    y += SECTION_GAP
  }

  const filename = `report-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
