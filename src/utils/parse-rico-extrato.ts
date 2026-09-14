'use client'

import type { TransactionType } from '@/types'
import { toLocalISO } from './local-date'
import { validateImportRowCount } from '@/lib/import-limits'
import { excelSerialToISO, readXlsxSheetRows, type XlsxRow } from '@/utils/read-xlsx'

export interface RicoExtratoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  subcategory: string | null
  valid: boolean
  errors: string[]
}

function excelDateToISO(value: unknown): string {
  if (value instanceof Date) {
    // toLocalISO, não toISOString: a biblioteca devolve a data como Date à
    // meia-noite local, e converter para UTC no Brasil joga para o dia
    // anterior — todo lançamento do extrato entrava com data de véspera.
    // (14.22)
    return toLocalISO(value)
  }
  if (typeof value === 'number') {
    return excelSerialToISO(value)
  }
  const s = String(value ?? '').trim()
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return s
}

// Detecta o "Extrato da conta" (histórico de movimentações) da RICO/XP
export function isRicoExtratoRows(rows: XlsxRow[]): boolean {
  return rows.some(r => r.some(cell => String(cell ?? '').includes('Extrato da conta')))
}

function classifyTickerType(ticker: string): string | null {
  if (/11[BU]?$/.test(ticker)) return 'Rendimentos FII'
  if (/[3-8]$/.test(ticker)) return 'Dividendos Ações'
  return null
}

export async function parseRicoExtratoXLSX(buffer: ArrayBuffer): Promise<RicoExtratoRow[]> {
  const rows = await readXlsxSheetRows(buffer, 1)
  const rowCheck = validateImportRowCount(rows.length)
  if (!rowCheck.ok) throw new Error(rowCheck.error)

  const headerIdx = rows.findIndex(r =>
    String(r[0] ?? '').trim() === 'Movimentação' && String(r[2] ?? '').trim() === 'Lançamento',
  )
  if (headerIdx === -1) return []

  const result: RicoExtratoRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const dateRaw = row[0]
    const lancamento = String(row[2] ?? '').trim()
    const valorRaw = row[4]

    // `continue`, não `break`. A data pode vir como texto ("13/09/2026") em vez
    // de número/Date — excelDateToISO já sabe ler os dois —, e o break
    // encerrava o parser na primeira linha assim, descartando em silêncio todo
    // o resto do arquivo. Linha realmente vazia continua parando o loop. (14.23)
    if (!lancamento) break
    const dateUsable = typeof dateRaw === 'number'
      || dateRaw instanceof Date
      || /^\d{2}\/\d{2}\/\d{4}$/.test(String(dateRaw ?? '').trim())
    if (!dateUsable) continue
    if (lancamento.toLowerCase().includes('não há lançamentos')) break

    const amount = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw))
    if (isNaN(amount) || amount === 0) continue

    const date = excelDateToISO(dateRaw)

    let category = 'Outros'
    let subcategory: string | null = null
    let type: TransactionType

    const rendMatch = lancamento.match(/^RENDIMENTOS DE CLIENTES\s+(\S+)/i)
    const dividendoMatch = lancamento.match(/^DIVIDENDOS DE CLIENTES\s+(\S+)/i)
    const jcpMatch = lancamento.match(/^JUROS S\/\s*CAPITAL DE CLIENTES\s+(\S+)/i)

    if (rendMatch) {
      category = 'Rendimentos'
      subcategory = classifyTickerType(rendMatch[1])
      type = 'receita'
    } else if (dividendoMatch) {
      category = 'Rendimentos'
      subcategory = 'Dividendos'
      type = 'receita'
    } else if (jcpMatch) {
      category = 'Rendimentos'
      subcategory = 'Juros sobre Capital Próprio'
      type = 'receita'
    } else if (/^FRA[ÇC][ÕO]ES DE A[ÇC][ÕO]ES\b/i.test(lancamento)) {
      category = 'Investimento'
      subcategory = 'Frações de Ativos'
      type = amount < 0 ? 'despesa' : 'receita'
    } else if (lancamento.toUpperCase().startsWith('OPERAÇÕES EM BOLSA')) {
      category = 'Investimento'
      subcategory = amount < 0 ? 'Compra de Ativos' : 'Venda de Ativos'
      type = amount < 0 ? 'despesa' : 'receita'
    } else {
      type = amount < 0 ? 'despesa' : 'receita'
    }

    result.push({
      description: lancamento,
      amount: Math.abs(amount),
      date,
      type,
      category,
      subcategory,
      valid: true,
      errors: [],
    })
  }

  return result
}
