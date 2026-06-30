'use client'

import type { TransactionType } from '@/types'

export interface MercadoPagoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  valid: boolean
  errors: string[]
}

function parseBRValue(raw: string): number {
  // "1,48" → 1.48  |  "2.000,00" → 2000.0  |  "-2.000,00" → -2000.0
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}

function parseBRDate(raw: string): string {
  // "04-05-2026" → "2026-05-04"
  const [d, m, y] = raw.split('-')
  return `${y}-${m}-${d}`
}

export async function parseMercadoPagoPDF(buffer: ArrayBuffer): Promise<MercadoPagoRow[] | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    // Use local worker copy (public/pdf.worker.min.mjs) — CDN is unreliable for this version
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise

    // Collect all text items from every page into a flat array
    const parts: string[] = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const tc = await page.getTextContent()
      for (const item of tc.items) {
        if ('str' in item && item.str.trim()) parts.push(item.str.trim())
      }
    }

    const fullText = parts.join(' ').replace(/\s+/g, ' ')

    if (!fullText.trim()) {
      throw new Error('empty-pdf')
    }

    // Each transaction row: DD-MM-YYYY <description> <12+digit operation ID> R$ <value>
    // The long numeric ID is the reliable delimiter between description and value.
    const regex = /(\d{2}-\d{2}-\d{4})\s+(.*?)\s+(\d{12,})\s+R\$\s*([-\d.,]+)/g

    const rows: MercadoPagoRow[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(fullText)) !== null) {
      const [, dateRaw, descRaw, , valueRaw] = match

      const date = parseBRDate(dateRaw)
      const description = descRaw.trim()
      const rawValue = parseBRValue(valueRaw)

      if (isNaN(rawValue) || rawValue === 0) continue

      const amount = Math.abs(rawValue)
      const type: TransactionType = rawValue < 0 ? 'despesa' : 'receita'

      rows.push({ description, amount, date, type, category: 'Outros', valid: true, errors: [] })
    }

    return rows.length ? rows : null
  } catch (err) {
    console.error('[parseMercadoPagoPDF]', err)
    return null
  }
}
