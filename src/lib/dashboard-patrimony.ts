import { Transaction, TransactionBoard } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export { fmt as formatDashboardCurrency }

/**
 * Saldo acumulado de um conjunto de transações.
 *
 * Transferência é neutra em receita/despesa, mas NÃO é neutra no saldo: o
 * dinheiro sai mesmo de uma conta e entra mesmo na outra. Quando as duas
 * pernas do movimento existem (os dois extratos importados), elas se anulam
 * sozinhas no total — não é preciso deduplicar nada — e cada conta fica com
 * o saldo certo. Quando só uma perna existe (ex: TED para a corretora, cujo
 * outro lado entra pela posição importada), a saída desconta do caixa e a
 * posição soma o lado investido, sem contar o mesmo dinheiro duas vezes.
 *
 * Transferência sem `direction` (importada antes de set/2026) continua neutra:
 * é o comportamento antigo, preferível a chutar o sinal do saldo.
 */
export function balanceFromTransactions(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    if (t.type === 'transferencia') {
      if (t.direction === 'entrada') return acc + Number(t.amount)
      if (t.direction === 'saida') return acc - Number(t.amount)
      return acc
    }
    if (t.type === 'receita') return acc + Number(t.amount)
    return acc - Number(t.amount)
  }, 0)
}

export interface CashBoardBreakdown {
  boardId: string
  name: string
  color: string
  balance: number
}

export interface InvestmentBreakdown {
  boardId: string
  name: string
  patrimonio: number
  importedAt?: string
}

export interface PatrimonyOverview {
  cashTotal: number
  investmentsTotal: number
  totalPatrimony: number
  cashBreakdown: CashBoardBreakdown[]
  unassignedCash: number
  investments: InvestmentBreakdown[]
  missingInvestmentImport: { boardId: string; name: string }[]
}

export function computePatrimonyOverview(
  boards: TransactionBoard[],
  cashTransactions: Transaction[],
): PatrimonyOverview {
  const cashBoards = boards.filter(b => !b.is_investment)
  const investmentBoards = boards.filter(b => b.is_investment)

  const cashBreakdown: CashBoardBreakdown[] = cashBoards.map(board => ({
    boardId: board.id,
    name: board.name,
    color: board.color,
    balance: balanceFromTransactions(
      cashTransactions.filter(t => t.board_id === board.id),
    ),
  }))

  const unassignedCash = balanceFromTransactions(
    cashTransactions.filter(t => !t.board_id),
  )

  const cashTotal =
    cashBreakdown.reduce((s, b) => s + b.balance, 0) + unassignedCash

  const investments: InvestmentBreakdown[] = []
  const missingInvestmentImport: { boardId: string; name: string }[] = []

  for (const board of investmentBoards) {
    const pos = board.last_position_import
    if (pos?.patrimonio != null) {
      investments.push({
        boardId: board.id,
        name: board.name,
        patrimonio: pos.patrimonio,
        importedAt: pos.importedAt,
      })
    } else {
      missingInvestmentImport.push({ boardId: board.id, name: board.name })
    }
  }

  const investmentsTotal = investments.reduce((s, i) => s + i.patrimonio, 0)

  return {
    cashTotal,
    investmentsTotal,
    totalPatrimony: cashTotal + investmentsTotal,
    cashBreakdown,
    unassignedCash,
    investments,
    missingInvestmentImport,
  }
}
