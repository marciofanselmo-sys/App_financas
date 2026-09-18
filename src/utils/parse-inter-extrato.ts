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
//   Pagamento efetuado: "Pagamento fatura cartao Inter"  -R$ 199,35  -R$ 199,35
//   Pix recebido: "Cp :31872495-MARCIO FAGUNDES ANSELMO"  R$ 200,00  R$ 0,65
//
// IMPORTANTE: o texto chega SEM quebras de linha. extractPdfText junta todos os
// fragmentos do pdf.js com espaço (`parts.join(' ')`), então o PDF inteiro é
// uma linha só. A primeira versão deste parser dividia por "\n", passou nos
// testes feitos com pdftotext (que preserva o layout) e no app devolvia ZERO
// lançamentos. Por isso a leitura é uma varredura sequencial: cada cabeçalho
// de data muda a data corrente, e cada lançamento usa a última data vista.
//
// Cada lançamento traz DOIS valores: o do lançamento e o saldo após ele. Só o
// primeiro interessa — pegar o último daria o saldo acumulado como se fosse
// o valor da transação.

const DATE_HEADER = /(\d{1,2})\s+de\s+([A-Za-zÀ-ú]+)\s+de\s+(\d{4})\s+Saldo do dia/y
const ENTRY = /([A-Za-zÀ-ú][A-Za-zÀ-ú ]*?):\s*"([^"]*)"\s+(-?)R\$\s*([\d.,]+)\s+-?R\$\s*[\d.,]+/y
// Qualquer coisa com cara de lançamento (descrição entre aspas seguida de
// valor). Serve para contar o que o parser NÃO conseguiu ler.
const ENTRY_SHAPED = /:\s*"[^"]*"\s+-?R\$\s*[\d.,]+/g

export function isInterExtratoPDF(text: string): boolean {
  const t = normalize(text)
  return t.includes('banco inter') && /\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4}\s+saldo do dia/.test(t)
}

export function parseInterExtratoPDF(text: string): InterExtratoResult {
  const rows: InterExtratoRow[] = []
  let currentDate: string | null = null

  // Varre o texto posição a posição: em cada ponto tenta um cabeçalho de data
  // ou um lançamento (regex com flag `y`, ancorada na posição atual). Nenhum
  // dos dois casando, avança um caractere.
  for (let i = 0; i < text.length; ) {
    DATE_HEADER.lastIndex = i
    const h = DATE_HEADER.exec(text)
    if (h) {
      const mes = MESES[normalize(h[2])]
      currentDate = mes ? `${h[3]}-${mes}-${h[1].padStart(2, '0')}` : null
      i = DATE_HEADER.lastIndex
      continue
    }

    ENTRY.lastIndex = i
    const e = ENTRY.exec(text)
    if (e) {
      i = ENTRY.lastIndex
      if (!currentDate) continue
      const valor = parseAmountBR(e[4]) * (e[3] === '-' ? -1 : 1)
      if (isNaN(valor) || valor === 0) continue
      rows.push(buildRow(e[1].trim(), e[2].trim(), valor, currentDate))
      continue
    }

    i++
  }

  // Tudo que tem cara de lançamento e não virou linha — inclusive os que
  // casaram mas ficaram sem data (`orphans`), que já estão dentro dessa conta.
  const candidates = (text.match(ENTRY_SHAPED) ?? []).length
  return { rows, skipped: Math.max(0, candidates - rows.length) }
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
