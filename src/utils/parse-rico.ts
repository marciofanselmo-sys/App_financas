import * as XLSX from 'xlsx'

export interface RICOPosition {
  ticker: string
  value: number
  allocation: string
  rentabilidade: string
}

export interface RICOData {
  patrimonio: number
  totalInvestido: number
  saldoDisponivel: number
  positions: RICOPosition[]
  importedAt: string
}

function parseBRL(value: unknown): number {
  if (typeof value !== 'string') return 0
  return parseFloat(
    String(value).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')
  ) || 0
}

export function parseRICOXLSX(buffer: ArrayBuffer): RICOData {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const ws = wb.Sheets['Sua carteira']
  if (!ws) throw new Error('Planilha "Sua carteira" não encontrada. Verifique se é o arquivo correto da RICO.')

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' })

  let patrimonio = 0
  let totalInvestido = 0
  let saldoDisponivel = 0
  const positions: RICOPosition[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cell0 = String(row[0] ?? '').trim()

    // Linha de cabeçalho do resumo: "Este é o seu patrimônio"
    if (cell0.toLowerCase().includes('patrimônio') || cell0.toLowerCase().includes('patrimonio')) {
      const next = rows[i + 1]
      if (next) {
        patrimonio      = parseBRL(next[0])
        totalInvestido  = parseBRL(next[1])
        saldoDisponivel = parseBRL(next[2])
      }
    }

    // Linhas de posição: ticker = letras maiúsculas + números (ex: CMIG4, XPML11, IVVB11)
    if (/^[A-Z]{3,5}\d{1,2}$/.test(cell0) && row[1]) {
      positions.push({
        ticker:        cell0,
        value:         parseBRL(String(row[1])),
        allocation:    String(row[2] ?? ''),
        rentabilidade: String(row[3] ?? ''),
      })
    }
  }

  if (patrimonio === 0) {
    throw new Error('Não foi possível ler os dados do arquivo. Verifique se é o arquivo "PosicaoDetalhada.xlsx" da RICO.')
  }

  return { patrimonio, totalInvestido, saldoDisponivel, positions, importedAt: new Date().toISOString() }
}
