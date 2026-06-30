import * as XLSX from 'xlsx'

export interface RICOPosition {
  ticker: string
  value: number
  allocation: string
  rentabilidade: string
  quantity?: string
  category: string
  subcategory: string
}

export interface RICOData {
  patrimonio: number
  totalInvestido: number
  saldoDisponivel: number
  positions: RICOPosition[]
  importedAt: string
}

function parseBRL(value: unknown): number {
  return parseFloat(
    String(value ?? '').replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')
  ) || 0
}

const STOP_KEYWORDS = ['dividendo', 'provento', 'distribuiç', 'custódia', 'custodi']

export function parseRICOXLSX(buffer: ArrayBuffer): RICOData {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets['Sua carteira']
  if (!ws) throw new Error('Planilha "Sua carteira" não encontrada. Verifique se é o arquivo correto da RICO.')

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  let patrimonio = 0
  let totalInvestido = 0
  let saldoDisponivel = 0
  const positions: RICOPosition[] = []

  let currentCategory = ''
  let currentSubcategory = ''
  let stop = false

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cell0 = String(row[0] ?? '').trim()
    const lower = cell0.toLowerCase()

    if (STOP_KEYWORDS.some(kw => lower.includes(kw))) {
      stop = true
    }

    // Patrimônio: cabeçalho seguido dos valores na próxima linha
    if (lower.includes('patrimônio') || lower.includes('patrimonio')) {
      const next = rows[i + 1]
      if (next) {
        patrimonio      = parseBRL(next[0])
        totalInvestido  = parseBRL(next[1])
        saldoDisponivel = parseBRL(next[2])
      }
    }

    if (stop) continue

    const isEmpty = (v: unknown) => String(v ?? '').trim() === ''

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

    // Posição: ticker = letras maiúsculas + dígitos (CMIG4, XPML11, IVVB11...)
    if (/^[A-Z]{3,6}\d{1,2}$/.test(cell0) && row[1]) {
      const col6 = String(row[6] ?? '').trim()
      const hasQuantity = col6 !== '' && !col6.includes('R$') && !isNaN(Number(col6))

      // FIIs: col[3]=c/ proventos, col[4]=Rentabilidade Bruta (sem proventos)
      // Ações: col[3]=Rentabilidade (%)
      const isFII = currentCategory === 'Fundos Imobiliários'
      const rentabilidade = isFII ? String(row[4] ?? '') : String(row[3] ?? '')

      positions.push({
        ticker:        cell0,
        value:         parseBRL(String(row[1])),
        allocation:    String(row[2] ?? ''),
        rentabilidade,
        quantity:      hasQuantity ? col6 : undefined,
        category:      currentCategory,
        subcategory:   currentSubcategory,
      })
    }
  }

  if (patrimonio === 0) {
    throw new Error('Não foi possível ler os dados do arquivo. Verifique se é o arquivo "PosicaoDetalhada.xlsx" da RICO.')
  }

  return { patrimonio, totalInvestido, saldoDisponivel, positions, importedAt: new Date().toISOString() }
}
