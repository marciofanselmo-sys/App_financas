import { Transaction, TransactionBoard } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export { fmt as formatDashboardCurrency }

/**
 * Data de hoje no fuso local, como YYYY-MM-DD.
 *
 * Deliberadamente sem `toISOString()`: ele converte para UTC, então depois das
 * ~21h no horário de Brasília já devolve o dia seguinte — e uma parcela de
 * amanhã passaria a contar no saldo de hoje.
 */
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Só o que já aconteceu.
 *
 * Parcelas futuras ficam salvas na conta com a data em que vão cair. Elas são
 * compromisso, não dinheiro que já saiu — somá-las no saldo mostra a conta
 * mais pobre (ou mais rica) do que ela está hoje.
 */
export function upToToday<T extends { date: string }>(transactions: T[]): T[] {
  const today = todayISO()
  return transactions.filter(t => t.date <= today)
}

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
      upToToday(cashTransactions.filter(t => t.board_id === board.id)),
    ),
  }))

  const unassignedCash = balanceFromTransactions(
    upToToday(cashTransactions.filter(t => !t.board_id)),
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
