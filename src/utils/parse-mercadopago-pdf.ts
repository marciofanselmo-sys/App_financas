'use client'

import type { TransactionType } from '@/types'
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
    const type: TransactionType = rawValue < 0 ? 'despesa' : 'receita'

    rows.push({ description, amount, date, type, category: 'Outros', valid: true, errors: [] })
  }

  return rows.length ? rows : null
}

/**
 * Quantos trechos do texto têm cara de lançamento, lidos ou não.
 *
 * Comparado com o número de linhas que o parser devolveu, dá quantas ficaram
 * de fora — que a importação avisa em vez de descartar em silêncio. O padrão
 * é deliberadamente mais frouxo que o do parser: ele reconhece o lançamento
 * sem exigir o resto do layout, então uma linha que o parser não consegue
 * ler ainda é contada. Validado contra arquivo real: bate com a leitura
 * completa, sem alarme falso.
 */
export function countMercadoPagoCandidates(fullText: string): number {
  // Dois valores em reais SEGUIDOS — o do lançamento e o saldo depois dele.
  // Toda linha de movimento tem esse par; o cabeçalho ("Entradas: R$ X
  // Saidas: R$ Y") não, porque lá os valores vêm separados por rótulo.
  //
  // Não usar o ID de operação aqui, embora seja o que o parser usa: o contador
  // precisa ser INDEPENDENTE do parser. Se o formato do ID mudar, o parser
  // perde a linha — e um contador baseado no mesmo ID perderia junto, sem
  // avisar nada. Com o par de valores, a linha continua contada e o aviso sai.
  return (stripBoilerplate(fullText).match(/R\$\s*[-\d.,]+\s+R\$\s*[-\d.,]+/g) ?? []).length
}
