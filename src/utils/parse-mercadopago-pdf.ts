'use client'

import type { TransactionType } from '@/types'
import { isTransferDescription } from './detect-transfer'
import { parseAmountBR } from './parse-amount'
import { stripEmbeddedDate } from './strip-embedded-date'

export interface MercadoPagoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  valid: boolean
  errors: string[]
}

function parseBRDate(raw: string): string {
  // "04-05-2026" → "2026-05-04"
  const [d, m, y] = raw.split('-')
  return `${y}-${m}-${d}`
}

// Detecta se o texto extraído do PDF é um Extrato de Conta do Mercado Pago —
// procura o delimitador de ID de operação que só esse formato usa.
export function isMercadoPagoPDF(text: string): boolean {
  return /\d{2}-\d{2}-\d{4}\s+.*?\d{12,}\s+R\$/.test(text)
}

export function parseMercadoPagoPDF(fullText: string): MercadoPagoRow[] | null {
  // Each transaction row: DD-MM-YYYY <description> <12+digit operation ID> R$ <value>
  // The long numeric ID is the reliable delimiter between description and value.
  const regex = /(\d{2}-\d{2}-\d{4})\s+(.*?)\s+(\d{12,})\s+R\$\s*([-\d.,]+)/g

  const rows: MercadoPagoRow[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(fullText)) !== null) {
    const [, dateRaw, descRaw, , valueRaw] = match

    const date = parseBRDate(dateRaw)
    const description = stripEmbeddedDate(descRaw.trim())
    const rawValue = parseAmountBR(valueRaw)

    if (isNaN(rawValue) || rawValue === 0) continue

    const amount = Math.abs(rawValue)
    const type: TransactionType = isTransferDescription(description)
      ? 'transferencia'
      : rawValue < 0 ? 'despesa' : 'receita'

    rows.push({ description, amount, date, type, category: 'Outros', valid: true, errors: [] })
  }

  return rows.length ? rows : null
}
