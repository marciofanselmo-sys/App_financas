'use client'

import type { TransactionType } from '@/types'
import { parseAmountBR } from './parse-amount'

export interface InterExtratoRow {
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  valid: boolean
  errors: string[]
}

/** Resultado do parser: as linhas lidas e quantas não deram para ler. */
export interface InterExtratoResult {
  rows: InterExtratoRow[]
  /**
   * Linhas que pareciam lançamento mas o parser não conseguiu interpretar.
   *
   * Existe para o arquivo nunca voltar "parcialmente importado" em silêncio —
   * foi exatamente um descarte silencioso que fez o saldo de um cartão ficar
   * meses divergindo sem ninguém saber por quê.
   */
  skipped: number
}

const MESES: Record<string, string> = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function brToISO(raw: string): string | null {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// Cabeçalho do arquivo exportado pelo Inter:
//   " Extrato Conta Corrente "
//   Conta ;<numero>
//   Período ;<inicio> a <fim>
//   Saldo ;<valor>
//   (linha em branco)
//   Data Lançamento;Histórico;Descrição;Valor;Saldo

export function isInterExtratoCSV(content: string): boolean {
  const head = normalize(content.slice(0, 400))
  return head.includes('extrato conta corrente') && head.includes('data lancamento')
}

export function parseInterExtratoCSV(content: string): InterExtratoResult {
  const lines = content.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => normalize(l).includes('data lancamento'))
  if (headerIdx === -1) return { rows: [], skipped: 0 }

  const rows: InterExtratoRow[] = []
  let skipped = 0

  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue
    const cols = line.split(';')
    // Data;Histórico;Descrição;Valor;Saldo — menos que isso não é lançamento.
    if (cols.length < 4) { skipped++; continue }

    const date = brToISO(cols[0].trim())
    const valor = parseAmountBR(cols[3].trim())
    if (!date || isNaN(valor) || valor === 0) { skipped++; continue }

    rows.push(buildRow(cols[1].trim(), cols[2].trim(), valor, date))
  }

  return { rows, skipped }
}

// ── PDF ──────────────────────────────────────────────────────────────────────
// A data é um CABEÇALHO de seção, não uma coluna:
//   11 de Janeiro de 2026 Saldo do dia: R$ 0,65
//   Pagamento efetuado: "Pagamento fatura cartao Inter"   -R$ 199,35   -R$ 199,35
//   Pix recebido: "Cp :31872495-MARCIO FAGUNDES ANSELMO"   R$ 200,00    R$ 0,65
//
// Cada linha traz DOIS valores: o do lançamento e o saldo após ele. Só o
// primeiro interessa — pegar o último daria o saldo acumulado como se fosse
// o valor da transação.

export function isInterExtratoPDF(text: string): boolean {
  const t = normalize(text)
  return t.includes('banco inter') && /\d{2}\s+de\s+[a-z]+\s+de\s+\d{4}\s+saldo do dia/.test(t)
}

export function parseInterExtratoPDF(text: string): InterExtratoResult {
  const rows: InterExtratoRow[] = []
  let skipped = 0
  let currentDate: string | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const header = line.match(/^(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/)
    if (header) {
      const mes = MESES[normalize(header[2])]
      currentDate = mes ? `${header[3]}-${mes}-${header[1].padStart(2, '0')}` : null
      continue
    }

    // "Histórico: "Descrição"  -R$ valor  -R$ saldo"
    const entry = line.match(/^(.+?):\s*"(.*?)"\s+(-?)R\$\s*([\d.,]+)/)
    if (!entry) {
      // Conta como descartada só a linha com cara de lançamento: histórico,
      // dois-pontos e valor. O bloco de cabeçalho ("R$ 0,00  R$ 0,00  R$ 0,00")
      // tem valor mas não tem histórico, e contá-lo daria alarme falso.
      if (/^[A-Za-zÀ-ú][^:]*:/.test(line) && /R\$\s*[\d.,]+/.test(line)) skipped++
      continue
    }
    if (!currentDate) { skipped++; continue }

    const valor = parseAmountBR(entry[4]) * (entry[3] === '-' ? -1 : 1)
    if (isNaN(valor) || valor === 0) { skipped++; continue }

    rows.push(buildRow(entry[1].trim(), entry[2].trim(), valor, currentDate))
  }

  return { rows, skipped }
}

// ── comum ────────────────────────────────────────────────────────────────────

function buildRow(historico: string, descricao: string, valor: number, date: string): InterExtratoRow {
  // Junta histórico e descrição porque os dois carregam informação diferente e
  // ambas importam: o histórico diz O QUE foi ("Pagamento efetuado"), a
  // descrição diz PARA QUEM ("Fatura cartão Inter"). É dessa junção que sai o
  // reconhecimento automático de pagamento de fatura — que precisa ver tanto a
  // intenção quanto o nome da conta de destino.
  // "Cp :31872495-MARCIO FAGUNDES ANSELMO" — o PDF prefixa o identificador
  // interno do Inter. Sem tirar, ele entra na descrição, atrapalha o
  // agrupamento de recorrentes e a herança de categoria por histórico.
  const limpa = descricao.replace(/^Cp\s*:\s*\d+\s*-\s*/i, '').trim()

  const description = limpa && normalize(limpa) !== normalize(historico)
    ? `${historico} - ${limpa}`
    : historico

  return {
    description,
    amount: Math.abs(valor),
    date,
    type: (valor > 0 ? 'receita' : 'despesa') as TransactionType,
    category: 'Outros',
    valid: true,
    errors: [],
  }
}
