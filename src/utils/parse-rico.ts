import * as XLSX from 'xlsx'

export interface RICOPosition {
  ticker: string
  value: number
  allocation: string
  rentabilidade: string
  quantity?: string
  avgPrice?: number
  lastPrice?: number
  category: string
  subcategory: string
}

// Rendimento/dividendo/JCP já provisionado pela corretora, com data prevista
// de pagamento — ainda não caiu na conta, é um "a receber".
export interface RICOProvento {
  ticker: string
  quantity: string
  allocation: string
  grossValue: number
  netValue: number
  event: string        // "DIVIDENDO" | "JUROS SOBRE CAPITAL PROPRIO" | "RENDIMENTO" etc.
  paymentDate: string   // YYYY-MM-DD
  category: string
  subcategory: string
}

export interface RICOData {
  patrimonio: number
  totalInvestido: number
  saldoDisponivel: number
  positions: RICOPosition[]
  proventos: RICOProvento[]
  importedAt: string
}

function parseBRL(value: unknown): number {
  return parseFloat(
    String(value ?? '').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')
  ) || 0
}

// "16/10/2028" → "2028-10-16"
function parseBRDate(value: unknown): string {
  const s = String(value ?? '').trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

const isEmpty = (v: unknown) => String(v ?? '').trim() === ''

export function parseRICOXLSX(buffer: ArrayBuffer): RICOData {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets['Sua carteira']
  if (!ws) throw new Error('Planilha "Sua carteira" não encontrada. Verifique se é o arquivo correto da RICO.')

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  let patrimonio = 0
  let totalInvestido = 0
  let saldoDisponivel = 0
  const positions: RICOPosition[] = []
  const proventos: RICOProvento[] = []

  let currentCategory = ''
  let currentSubcategory = ''
  // O arquivo tem duas seções com o MESMO formato de cabeçalho (categoria
  // com subtotal em R$, subcategoria "X% | Nome", linhas de dados por
  // ticker) — a diferença é o que as colunas de cada linha significam.
  // "Dividendos, proventos e outras distribuições" marca a virada da
  // primeira seção (posições atuais) pra segunda (proventos já provisionados,
  // com data prevista de pagamento — ainda não pagos).
  let inProventos = false

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cell0 = String(row[0] ?? '').trim()
    const lower = cell0.toLowerCase()

    // Patrimônio: cabeçalho seguido dos valores na próxima linha
    if (lower.includes('patrimônio') || lower.includes('patrimonio')) {
      const next = rows[i + 1]
      if (next) {
        patrimonio      = parseBRL(next[0])
        totalInvestido  = parseBRL(next[1])
        saldoDisponivel = parseBRL(next[2])
      }
      continue
    }

    if (lower.includes('dividendos') && lower.includes('proventos')) {
      inProventos = true
      currentCategory = ''
      currentSubcategory = ''
      continue
    }

    // Categoria principal: col[0] tem texto, cols[1-3] vazias, col[6] tem "R$"
    // ex: ["Fundos Imobiliários","","","","","","R$ 735,95"]
    if (cell0 && isEmpty(row[1]) && isEmpty(row[2]) && isEmpty(row[3]) && String(row[6] ?? '').includes('R$')) {
      currentCategory = cell0
      currentSubcategory = ''
      continue
    }

    // Subcategoria: "XX% | Nome" na col[0]
    // ex: "11,9% | Fundos Listados"
    if (cell0.includes('%') && cell0.includes('|')) {
      currentSubcategory = cell0.split('|')[1].trim()
      continue
    }

    // Linha de dados: ticker = letras maiúsculas + dígitos (CMIG4, XPML11, IVVB11...)
    if (/^[A-Z]{3,6}\d{1,2}$/.test(cell0) && row[1]) {
      if (inProventos) {
        // ["FIQE3","20","0,02%","R$ 2,26","R$ 2,26","DIVIDENDO","16/10/2028"]
        proventos.push({
          ticker: cell0,
          quantity: String(row[1] ?? ''),
          allocation: String(row[2] ?? ''),
          grossValue: parseBRL(row[3]),
          netValue: parseBRL(row[4]),
          event: String(row[5] ?? ''),
          paymentDate: parseBRDate(row[6]),
          category: currentCategory,
          subcategory: currentSubcategory,
        })
        continue
      }

      const col6 = String(row[6] ?? '').trim()
      const hasQuantity = col6 !== '' && !col6.includes('R$') && !isNaN(Number(col6))

      // FIIs: col[3]=c/ proventos, col[4]=Rentabilidade Bruta, col[5]=Preço
      // médio, col[6]=Última cotação.
      // Ações/outros: col[3]=Rentabilidade (%), col[4]=Preço médio,
      // col[5]=Último preço, col[6]=Qtd. total.
      const isFII = currentCategory === 'Fundos Imobiliários'
      const rentabilidade = isFII ? String(row[4] ?? '') : String(row[3] ?? '')
      const avgPrice = parseBRL(isFII ? row[5] : row[4])
      const lastPrice = isFII ? parseBRL(row[6]) : parseBRL(row[5])

      positions.push({
        ticker:        cell0,
        value:         parseBRL(String(row[1])),
        allocation:    String(row[2] ?? ''),
        rentabilidade,
        quantity:      hasQuantity ? col6 : undefined,
        avgPrice:      avgPrice > 0 ? avgPrice : undefined,
        lastPrice:     lastPrice > 0 ? lastPrice : undefined,
        category:      currentCategory,
        subcategory:   currentSubcategory,
      })
    }
  }

  if (patrimonio === 0) {
    throw new Error('Não foi possível ler os dados do arquivo. Verifique se é o arquivo "PosicaoDetalhada.xlsx" da RICO.')
  }

  return { patrimonio, totalInvestido, saldoDisponivel, positions, proventos, importedAt: new Date().toISOString() }
}
