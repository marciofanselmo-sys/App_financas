import { Transaction, TransactionBoard } from '@/types'
import { todayISO } from '@/utils/local-date'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export { fmt as formatDashboardCurrency }

/**
 * Só o que já aconteceu.
 *
 * Parcelas futuras ficam salvas na conta com a data em que vão cair. Elas são
 * compromisso, não dinheiro que já saiu — somá-las no saldo mostra a conta
 * mais pobre (ou mais rica) do que ela está hoje.
 */
export { todayISO }

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

/**
 * Saldo de UMA conta, pelo mesmo critério do card em Contas e Cartões:
 * saldo inicial + entradas − saídas, até hoje.
 *
 * Existe para o app conseguir mostrar o efeito de uma ação ANTES de ela
 * acontecer — excluir ou mover em massa mudava o saldo em milhares de reais
 * sem nenhum sinal na tela, e só se descobria semanas depois.
 */
export function accountBalance(transactions: Transaction[], openingBalance = 0): number {
  return Number(openingBalance) + balanceFromTransactions(upToToday(transactions))
}

/**
 * Cartão de crédito com saldo positivo — quase sempre é dado faltando.
 *
 * Positivo num cartão significaria que o banco deve ao usuário, o que só
 * acontece de verdade com estorno ou pagamento a maior, e por pouco tempo. Na
 * prática o sintoma aparece quando há pagamentos sem as compras que eles
 * quitaram: fatura importada pela metade, lançamentos apagados numa edição,
 * histórico de compras começando depois do de pagamentos. Um cartão ficou
 * semanas em +R$ 11.984 por isso, e só foi percebido por conciliação manual.
 *
 * O único sinal persistido de "é cartão" é o ícone escolhido na criação —
 * por isso isto é um AVISO, nunca um bloqueio: o usuário pode ter trocado o
 * ícone, e um falso positivo não pode impedir nada.
 */
export function looksLikeMissingCardData(board: { icon?: string }, balance: number): boolean {
  return board.icon === 'credit-card' && balance > 0.005
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
