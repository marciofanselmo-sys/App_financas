'use client'

import type { TransactionType } from '@/types'
import { isTransferDescription } from './detect-transfer'
import { parseAmountBR } from './parse-amount'
import { stripEmbeddedDate } from './strip-embedded-date'

export interface InterInvoiceRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  installment_current?: number | null
  installment_total?: number | null
  valid: boolean
  errors: string[]
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
}

function parseInterDate(day: string, monthAbbr: string, year: string): string | null {
  const month = MONTH_MAP[monthAbbr.toLowerCase().slice(0, 3)]
  if (!month) return null
  return `${year}-${month}-${day.padStart(2, '0')}`
}

// Extrai a "Data de Vencimento" da fatura (ex: "Data de Vencimento 02/07/2026").
// É o único campo de data que avança corretamente mês a mês — confirmado
// comparando 6 faturas reais consecutivas. A coluna "Data" de uma linha
// parcelada mostra a data da COMPRA original e se REPETE igual em toda fatura
// onde aquela parcela aparece (só o "Parcela X de Y" muda). Usar a data da
// coluna direto faz cada parcela seguinte parecer duplicata da anterior
// (mesma data+valor+descrição) e ser silenciosamente ignorada na importação.
function parseDueDate(fullText: string): string | null {
  const m = fullText.match(/Data de Vencimento\s+(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return null
  const [, day, month, year] = m
  return `${year}-${month}-${day}`
}

// Detecta se o texto extraído do PDF é uma fatura de cartão do Banco Inter —
// procura o cabeçalho da tabela de despesas + alguma referência à marca.
export function isInterInvoicePDF(text: string): boolean {
  return text.includes('Despesas da fatura') && (text.includes('BANCO INTER') || text.toLowerCase().includes('bancointer'))
}

export function parseInterInvoicePDF(fullText: string): InterInvoiceRow[] {
  const rows: InterInvoiceRow[] = []
  const dueDate = parseDueDate(fullText)

  // Cada linha de despesa: "DD de mmm[.] AAAA <movimentação> - [+] R$ <valor>"
  // O "-" antes do valor é a coluna Beneficiário (quase sempre vazia em fatura
  // de cartão); "+" na frente do R$ marca estorno/pagamento recebido.
  const rowRegex = /(\d{2})\s+de\s+([a-zçÇ]{3,4})\.?\s+(\d{4})\s+(.+?)\s+-\s+(\+\s*)?R\$\s*([\d.,]+)/gi

  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(fullText)) !== null) {
    const [, day, monthAbbr, year, descRaw, plusSign, valueRaw] = match

    // Ignora linhas de subtotal ("Total CARTÃO ****1234 R$ 0,00")
    if (/^total\s+cart[ãa]o/i.test(descRaw.trim())) continue

    const date = parseInterDate(day, monthAbbr, year)
    const errors: string[] = []

    const amount = parseAmountBR(valueRaw)
    if (isNaN(amount) || amount <= 0) errors.push('Valor inválido')

    // O pdf.js às vezes separa a primeira letra do resto da palavra com um
    // espaço espúrio (ex: "P AGAMENTO DE FATURA") — junta de volta.
    let description = descRaw.trim().replace(/^([A-ZÀ-Ú])\s+([A-ZÀ-Ú]{2,})/, '$1$2')
    let installment_current: number | null = null
    let installment_total: number | null = null
    const parcelaMatch = description.match(/\(Parcela\s+(\d+)\s+de\s+(\d+)\)\s*$/i)
    let effectiveDate = date
    if (parcelaMatch) {
      installment_current = parseInt(parcelaMatch[1])
      installment_total = parseInt(parcelaMatch[2])
      description = description.replace(/\s*\(Parcela\s+\d+\s+de\s+\d+\)\s*$/i, '').trim()
      // Usa a data de vencimento da fatura, não a data de compra repetida —
      // ver comentário de parseDueDate() pra entender por quê.
      if (dueDate) effectiveDate = dueDate
    }
    description = stripEmbeddedDate(description)

    if (!effectiveDate) errors.push('Data inválida')
    if (!description) errors.push('Descrição vazia')

    // Numa fatura de cartão, uma linha com "+" é sempre dinheiro voltando pro
    // cartão (pagamento da fatura, adiantamento, estorno) — nunca renda de
    // verdade, mesmo quando a descrição não bate com nenhum padrão conhecido
    // de "pagamento de fatura" (ex: "PAGAMENTO ON LINE"). Por isso qualquer "+"
    // vira transferência por padrão, sem depender de reconhecer o texto exato.
    const type: TransactionType = plusSign || isTransferDescription(description)
      ? 'transferencia'
      : 'despesa'

    rows.push({
      description,
      amount: isNaN(amount) ? 0 : amount,
      date: effectiveDate ?? '',
      type,
      category: 'Outros',
      installment_current,
      installment_total,
      valid: errors.length === 0,
      errors,
    })
  }

  return rows
}
