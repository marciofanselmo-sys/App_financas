'use client'

import type { TransactionType } from '@/types'
import { isTransferDescription } from './detect-transfer'
import { parseAmountBR } from './parse-amount'
import { stripEmbeddedDate } from './strip-embedded-date'

export interface ItauExtratoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  valid: boolean
  errors: string[]
}

function parseBRDate(raw: string): string {
  // "30/06/2026" → "2026-06-30"
  const [d, m, y] = raw.split('/')
  return `${y}-${m}-${d}`
}

export function isItauExtratoPDF(text: string): boolean {
  return text.includes('extrato conta / lançamentos') && /ita[uú]/i.test(text)
}

export function parseItauExtratoPDF(fullText: string): ItauExtratoRow[] | null {
  // A tabela começa logo após o cabeçalho de colunas "saldo (R$)" — cortar
  // antes disso evita que "período de visualização: 01/01/2026..." no topo
  // do documento seja confundido com a data da primeira transação.
  const tableStart = fullText.indexOf('saldo (R$)')
  const tableText = tableStart !== -1 ? fullText.slice(tableStart + 'saldo (R$)'.length) : fullText

  // Cada linha: DD/MM/YYYY <lançamento> <valor>, delimitada pela próxima data
  // ou pelo rodapé "Aviso!" (não há coluna de saldo por linha nesse extrato).
  const rowRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})(?=\s+\d{2}\/\d{2}\/\d{4}|\s+Aviso!)/g

  const rows: ItauExtratoRow[] = []
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(tableText)) !== null) {
    const [, dateRaw, descRaw, valueRaw] = match

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
