'use client'

import type { TransactionType } from '@/types'
import { parseAmountBR } from './parse-amount'

/**
 * Extrato da conta corrente do C6 Bank em PDF.
 *
 * O pdf.js entrega o documento numa linha só (ver extract-pdf-text), então o
 * leitor varre o texto em sequência. Cada mês abre com
 * "Setembro 2026 ( 20/09/2026 - 30/09/2026 )" — de onde vem o ano — e cada
 * lançamento é "20/09 21/09 <Tipo> <Descrição> -R$ 110,00" (data de
 * lançamento, data contábil, tipo, descrição, valor).
 *
 * A descrição segue o CSV da mesma conta (coluna Título), para regras,
 * histórico e deduplicação valerem igual nos dois formatos: no débito no
 * cartão vira o nome da loja; nos demais, o texto depois do tipo.
 */

export interface C6ExtratoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  cardDebit?: boolean
  valid: boolean
  errors: string[]
}

export interface C6ExtratoResult {
  rows: C6ExtratoRow[]
  skipped: number
}

const norm = (s: string) => s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function isC6ExtratoPDF(text: string): boolean {
  const t = norm(text)
  return t.includes('DATA LANCAMENTO DATA CONTABIL TIPO DESCRICAO VALOR') && t.includes('C6 BANK')
}

// Tipos que o C6 imprime antes da descrição (mais longos primeiro).
const TIPOS = [
  'Débito de Cartão', 'Estorno de Cartão', 'Crédito de Cartão', 'Devolução PIX', 'Entrada PIX', 'Saída PIX',
  'Outros gastos', 'Outras entradas', 'Outros créditos', 'Transferência', 'Pagamento', 'Rendimento',
  'Aplicação', 'Resgate', 'Depósito', 'Estorno', 'Tarifa', 'Saque', 'Boleto', 'TED', 'DOC',
].sort((a, b) => b.length - a.length)

// Mês do extrato: dele vem o ano dos lançamentos ("dd/mm" não traz ano).
const SECTION = /\(\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\d{2}\/\d{2}\/\d{4}\s*\)/y
// Lançamento: data lançamento, data contábil, tipo + descrição, sinal e valor.
const ENTRY = /(\d{2})\/(\d{2})\s+\d{2}\/\d{2}\s+(.+?)\s+(-?)R\$\s*([\d.]+,\d{2})/y
const ENTRY_SHAPED = /\d{2}\/\d{2}\s+\d{2}\/\d{2}\s+\S/g

// Cidade de várias palavras começa com uma destas (até 13 letras, cortada).
const CITY_START = new Set(['SAO', 'SANTA', 'SANTO', 'RIO', 'R.', 'BELO', 'PORTO', 'CAMPO', 'CAMPOS', 'JUIZ', 'POCOS', 'TRES', 'NOVA', 'NOVO', 'BOM', 'BOA', 'SERRA', 'PRAIA', 'FOZ', 'LAGOA', 'MONTE', 'PONTE', 'ALTO', 'CABO', 'ARRAIAL', 'CONSELHEIRO', 'GOVERNADOR', 'PRESIDENTE', 'TEOFILO', 'VARZEA'])
const PREP = new Set(['DO', 'DOS', 'DE', 'DA', 'DAS', 'DEL', 'D'])

/**
 * "SENOR BRASA PARRILLA E VARGINHA BRA. Cartão 1332" → "SENOR BRASA PARRILLA E".
 *
 * No PDF os espaços de alinhamento somem e loja e cidade ficam grudadas. O C6
 * guarda a loja em até 22 letras e a cidade em até 13 (cortada): a cidade é a
 * última palavra, ou mais de uma quando começa com SAO/SANTA/RIO/BELO… ou
 * termina em preposição ("SANTA RITA DO"), e a loja nunca passa de 22.
 * Validado contra os CSVs da mesma conta: 61 de 61 lojas iguais.
 */
export function c6MerchantFromCollapsed(text: string): string {
  const base = text.replace(/\s*BRA\.?(\s+Cart[aã]o\s+\d+)?\s*$/i, '').replace(/\s+/g, ' ').trim()
  const w = base.split(' ')
  const n = w.length
  if (n < 2) return base
  let k = 1
  for (let j = Math.min(3, n - 1); j >= 2; j--) {
    if (w.slice(n - j).join(' ').length <= 13 && CITY_START.has(norm(w[n - j]))) { k = j; break }
  }
  while (k < n - 1 && PREP.has(norm(w[n - k]))) k++
  while (k < n - 1 && w.slice(0, n - k).join(' ').length > 22) k++
  return w.slice(0, n - k).join(' ')
}

function splitTipo(text: string): { tipo: string | null; descricao: string } {
  const t = norm(text)
  for (const tipo of TIPOS) {
    const nt = norm(tipo)
    if (t.startsWith(nt + ' ')) return { tipo, descricao: text.slice(tipo.length).trim() }
  }
  return { tipo: null, descricao: text.trim() }
}

export function parseC6ExtratoPDF(text: string): C6ExtratoResult {
  const rows: C6ExtratoRow[] = []
  let year: string | null = null

  for (let i = 0; i < text.length; ) {
    SECTION.lastIndex = i
    const s = SECTION.exec(text)
    if (s) {
      year = s[3]
      i = SECTION.lastIndex
      continue
    }

    ENTRY.lastIndex = i
    const e = ENTRY.exec(text)
    if (e) {
      i = ENTRY.lastIndex
      if (!year) continue
      const value = parseAmountBR(e[5])
      if (isNaN(value) || value === 0) continue
      const { tipo, descricao } = splitTipo(e[3])
      const cardDebit = !!tipo && norm(tipo) === 'DEBITO DE CARTAO'
      const description = cardDebit ? c6MerchantFromCollapsed(descricao) : descricao
      rows.push({
        description: description || e[3].trim(),
        amount: Math.abs(value),
        date: `${year}-${e[2]}-${e[1]}`,
        type: e[4] === '-' ? 'despesa' : 'receita',
        category: 'Outros',
        cardDebit,
        valid: true,
        errors: [],
      })
      continue
    }

    i++
  }

  const candidates = (text.match(ENTRY_SHAPED) ?? []).length
  return { rows, skipped: Math.max(0, candidates - rows.length) }
}
