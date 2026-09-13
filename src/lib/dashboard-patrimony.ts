import { Transaction, TransactionBoard } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export { fmt as formatDashboardCurrency }

/** Saldo acumulado: entradas menos saídas. Toda linha conta, sem exceção. */
export function balanceFromTransactions(transactions: Transaction[]): number {
  return transactions.reduce(
    (acc, t) => (t.type === 'receita' ? acc + Number(t.amount) : acc - Number(t.amount)),
    0,
  )
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
    // Saldo inicial + o que os lançamentos movimentaram. Sem a primeira
    // parcela, uma conta cujo histórico começa no meio nasce com o saldo
    // errado e nunca se corrige — não há lançamento que represente o que
    // já existia antes da primeira importação.
    balance: Number(board.opening_balance ?? 0) + balanceFromTransactions(
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
