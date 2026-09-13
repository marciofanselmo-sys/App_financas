import { Transaction, TransactionBoard } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export { fmt as formatDashboardCurrency }

/**
 * Saldo acumulado de um conjunto de transações.
 *
 * Movimentação interna (`is_internal`) NÃO é exceção aqui: pagar a própria
 * fatura ou mandar dinheiro para a corretora tira dinheiro da conta de
 * verdade. `is_internal` só importa para receita/despesa do mês — o saldo
 * conta toda linha, interna ou não. Foi justamente ignorar essas linhas no
 * saldo que causava 14.1 e 14.2.
 *
 * `transferencia` só aparece em linhas legadas que não foi possível
 * classificar na conversão de set/2026 (descrição sem direção). Continuam
 * neutras, como sempre foram.
 */
export function balanceFromTransactions(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => {
    if (t.type === 'transferencia') return acc
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
