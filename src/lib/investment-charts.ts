import { RICOPosition, TransactionBoard } from '@/types'
import { ChartSegment } from '@/lib/dashboard-charts'

export interface BoardAllocation {
  boardId: string
  name: string
  color: string
  patrimonio: number
  segments: ChartSegment[]
}

export interface TopAssetRow {
  ticker: string
  value: number
  category: string
  boardName: string
  boardColor: string
}

function positionsFromBoards(boards: TransactionBoard[]): { board: TransactionBoard; positions: RICOPosition[] }[] {
  return boards
    .filter(b => b.last_position_import?.positions?.length)
    .map(board => ({
      board,
      positions: board.last_position_import!.positions,
    }))
}

export function aggregateConsolidatedAllocation(boards: TransactionBoard[]): ChartSegment[] {
  const map = new Map<string, number>()
  for (const { positions } of positionsFromBoards(boards)) {
    for (const p of positions) {
      const cat = p.category || 'Outros'
      map.set(cat, (map.get(cat) ?? 0) + p.value)
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function aggregateBoardAllocations(boards: TransactionBoard[]): BoardAllocation[] {
  return boards
    .filter(b => b.last_position_import?.positions?.length)
    .map(board => {
      const map = new Map<string, number>()
      for (const p of board.last_position_import!.positions) {
        const cat = p.category || 'Outros'
        map.set(cat, (map.get(cat) ?? 0) + p.value)
      }
      return {
        boardId: board.id,
        name: board.name,
        color: board.color,
        patrimonio: board.last_position_import!.patrimonio,
        segments: Array.from(map.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value),
      }
    })
}

export function aggregateTopAssets(boards: TransactionBoard[], limit = 10): TopAssetRow[] {
  const rows: TopAssetRow[] = []
  for (const board of boards) {
    const positions = board.last_position_import?.positions ?? []
    for (const p of positions) {
      rows.push({
        ticker: p.ticker,
        value: p.value,
        category: p.category || 'Outros',
        boardName: board.name,
        boardColor: board.color,
      })
    }
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, limit)
}

export function totalInvestmentPatrimony(boards: TransactionBoard[]): number {
  return boards.reduce((s, b) => s + (b.last_position_import?.patrimonio ?? 0), 0)
}

export function hasInvestmentChartData(boards: TransactionBoard[]): boolean {
  return boards.some(b => (b.last_position_import?.positions?.length ?? 0) > 0)
}
