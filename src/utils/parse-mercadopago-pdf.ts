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

// O texto extraído do PDF vem em UMA linha só, sem quebras — então o cabeçalho
// (identificação da conta, período, saldos) e o rodapé institucional (SAC,
// ouvidoria, CNPJ) também contêm datas soltas ("Periodo: De 01-05-2026...",
// "Data de geração: 27-06-2026"). Sem remover esses blocos antes, o parser usa
// essas datas como âncora de uma transação fantasma e "engole" todo o texto de
// cabeçalho/rodapé como se fosse a descrição dela — e ainda perde a transação
// real seguinte, cujo ID e valor acabam roubados pra essa transação fantasma.
function stripBoilerplate(text: string): string {
  return text
    .replace(/EXTRATO DE CONTA[\s\S]*?DETALHE DOS MOVIMENTOS/g, '')
    .replace(/Data\s+Descrição\s+ID da operação\s+Valor\s+Saldo/g, '')
    .replace(/Data de geração:\s*\d{2}-\d{2}-\d{4}[\s\S]*?mercadopago\.com\.br/gi, '')
}

export function parseMercadoPagoPDF(fullText: string): MercadoPagoRow[] | null {
  const text = stripBoilerplate(fullText)

  // Each transaction row: DD-MM-YYYY <description> <12+digit operation ID> R$ <value>
  // The long numeric ID is the reliable delimiter between description and value.
  const regex = /(\d{2}-\d{2}-\d{4})\s+(.*?)\s+(\d{12,})\s+R\$\s*([-\d.,]+)/g

  const rows: MercadoPagoRow[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const [, dateRaw, descRaw, , valueRaw] = match

    const date = parseBRDate(dateRaw)
    const description = stripEmbeddedDate(descRaw.trim())
    const rawValue = parseAmountBR(valueRaw)

    if (isNaN(rawValue) || rawValue === 0) continue
    // Rede de segurança: descrição de transação real é curta (um nome de
    // quem enviou/recebeu o Pix, ou "Rendimentos"). Um trecho de boilerplate
    // que escape da limpeza acima sempre vem bem mais longo que isso.
    if (description.length > 100) continue

    const amount = Math.abs(rawValue)
    const type: TransactionType = isTransferDescription(description)
      ? 'transferencia'
      : rawValue < 0 ? 'despesa' : 'receita'

    rows.push({ description, amount, date, type, category: 'Outros', valid: true, errors: [] })
  }

  return rows.length ? rows : null
}
