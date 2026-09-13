import { PositionHistoryEntry, TransactionBoard } from '@/types'

export interface PatrimonyHistoryPoint {
  label: string
  date: string
  patrimonio: number
  boardName?: string
}

export function buildBoardPatrimonyHistory(board: TransactionBoard): PatrimonyHistoryPoint[] {
  const embedded = board.last_position_import?.history ?? []
  const column = board.position_import_history ?? []
  const entries: PositionHistoryEntry[] = [...embedded, ...column]

  if (board.last_position_import) {
    const lastAt = board.last_position_import.importedAt
    const alreadyHas = entries.some(e => e.importedAt === lastAt && e.patrimonio === board.last_position_import!.patrimonio)
    if (!alreadyHas) {
      entries.push({
        patrimonio: board.last_position_import.patrimonio,
        importedAt: lastAt,
      })
    }
  }

  return entries
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt))
    .map(e => ({
      label: new Date(e.importedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      date: e.importedAt,
      patrimonio: e.patrimonio,
      boardName: board.name,
    }))
}

export function buildConsolidatedPatrimonyHistory(boards: TransactionBoard[]): PatrimonyHistoryPoint[] {
  const investmentBoards = boards.filter(b => b.is_investment)
  const dateMap = new Map<string, number>()

  for (const board of investmentBoards) {
    const points = buildBoardPatrimonyHistory(board)
    for (const p of points) {
      const dayKey = p.date.slice(0, 10)
      dateMap.set(dayKey, (dateMap.get(dayKey) ?? 0) + p.patrimonio)
    }
  }

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, patrimonio]) => ({
      label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }),
      date,
      patrimonio,
    }))
}

export function hasPatrimonyHistory(boards: TransactionBoard[]): boolean {
  return boards.some(b =>
    (b.position_import_history?.length ?? 0) > 0 ||
    b.last_position_import != null,
  )
}

export interface PatrimonyVariation {
  current: number
  previous: number | null
  delta: number | null
  deltaPercent: number | null
  currentLabel: string
  previousLabel: string | null
  importedAt: string
  previousAt: string | null
  canCompare: boolean
}

/** Variação consolidada entre a última e a penúltima importação (por dia). */
export function computeConsolidatedPatrimonyVariation(boards: TransactionBoard[]): PatrimonyVariation | null {
  const history = buildConsolidatedPatrimonyHistory(boards)
  if (history.length === 0) return null

  const current = history[history.length - 1]
  const previous = history.length >= 2 ? history[history.length - 2] : null
  const previousVal = previous?.patrimonio ?? null
  const delta = previousVal != null ? current.patrimonio - previousVal : null
  const deltaPercent =
    delta != null && previousVal != null && previousVal !== 0
      ? (delta / previousVal) * 100
      : null

  return {
    current: current.patrimonio,
    previous: previousVal,
    delta,
    deltaPercent,
    currentLabel: current.label,
    previousLabel: previous?.label ?? null,
    importedAt: current.date,
    previousAt: previous?.date ?? null,
    canCompare: previous != null,
  }
}
