'use client'

import * as XLSX from 'xlsx'
import type { TransactionType } from '@/types'
import { isTransferDescription } from './detect-transfer'

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

function excelDateToISO(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial)
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

// Detecta o "Extrato da conta" (histórico de movimentações) da RICO/XP —
// diferente do "PosicaoDetalhada.xlsx" (posição da carteira), que já é
// suportado separadamente em parse-rico.ts.
export function isRicoExtratoXLSX(wb: XLSX.WorkBook): boolean {
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return false
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })
  // "Extrato da conta" fica numa célula lá pelo meio da linha (ex: coluna 5),
  // não necessariamente na primeira coluna — varre a linha inteira.
  return rows.some(r => r.some(cell => String(cell ?? '').includes('Extrato da conta')))
}

// Ticker de Fundo Imobiliário/Fiagro termina em "11" (ex: XPML11, BTLG11);
// ações terminam no dígito de classe (3=ON, 4=PN, 5/6=PN classe A/B) — dá pra
// separar o tipo de rendimento sem precisar cruzar com o arquivo de posição.
function classifyTickerType(ticker: string): string | null {
  if (/11[BU]?$/.test(ticker)) return 'Rendimentos FII'
  if (/[3-8]$/.test(ticker)) return 'Dividendos Ações'
  return null
}

export function parseRicoExtratoXLSX(buffer: ArrayBuffer): RicoExtratoRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' })

  const headerIdx = rows.findIndex(r =>
    String(r[0] ?? '').trim() === 'Movimentação' && String(r[2] ?? '').trim() === 'Lançamento'
  )
  if (headerIdx === -1) return []

  const result: RicoExtratoRow[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const dateRaw = row[0]
    const lancamento = String(row[2] ?? '').trim()
    const valorRaw = row[4]

    // Fim da tabela: linha em branco entre seções, ou "Não há lançamentos..."
    if (!lancamento || typeof dateRaw !== 'number') break
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
      // Rótulo já vem explícito como "dividendo" — não precisa da heurística
      // de sufixo do ticker pra saber o tipo.
      category = 'Rendimentos'
      subcategory = 'Dividendos'
      type = 'receita'
    } else if (jcpMatch) {
      category = 'Rendimentos'
      subcategory = 'Juros sobre Capital Próprio'
      type = 'receita'
    } else if (/^FRA[ÇC][ÕO]ES DE A[ÇC][ÕO]ES\b/i.test(lancamento)) {
      // Venda automática de frações de ações (sobra de bonificação/desdobramento).
      category = 'Investimento'
      subcategory = 'Frações de Ativos'
      type = amount < 0 ? 'despesa' : 'receita'
    } else if (lancamento.toUpperCase().startsWith('OPERAÇÕES EM BOLSA')) {
      // Negativo = compra de ativo (saída de caixa); positivo = venda (entrada).
      category = 'Investimento'
      subcategory = amount < 0 ? 'Compra de Ativos' : 'Venda de Ativos'
      type = amount < 0 ? 'despesa' : 'receita'
    } else if (isTransferDescription(lancamento)) {
      // TED/DOC de entrada ou saída — dinheiro movido entre a própria conta
      // corrente e a corretora, não uma receita/despesa nova.
      type = 'transferencia'
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
