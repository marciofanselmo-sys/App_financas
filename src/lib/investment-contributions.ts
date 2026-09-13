import { Transaction, TransactionBoard } from '@/types'
import { MonthBucket } from '@/lib/dashboard-charts'

/** Transferências para contas de investimento (regra 7.18). */
export function sumInvestmentContributions(
  transactions: Transaction[],
  boards: TransactionBoard[],
): number {
  const investmentIds = new Set(boards.filter(b => b.is_investment).map(b => b.id))
  const investmentNames = boards
    .filter(b => b.is_investment)
    .map(b => b.name.toLowerCase().trim())
    .filter(n => n.length >= 2)

  const matches = transactions.filter(t => {
    // Só movimentação interna: comprar algo com o cartão não é aporte.
    if (!t.is_internal) return false
    // Na própria conta de investimento, aporte é o dinheiro CHEGANDO. Até
    // set/2026 qualquer movimento contava, então um resgate era somado como
    // se fosse aporte — inflava o total investido no mês.
    if (t.board_id && investmentIds.has(t.board_id)) return t.type === 'receita'
    // Na conta de origem, aporte é o dinheiro SAINDO em direção à corretora.
    const desc = t.description.toLowerCase()
    return t.type === 'despesa' && investmentNames.some(name => desc.includes(name))
  })

  const seen = new Set<string>()
  let total = 0
  for (const t of matches) {
    const key = `${t.date}|${Number(t.amount)}`
    if (seen.has(key)) continue
    seen.add(key)
    total += Number(t.amount)
  }
  return total
}

export interface ContributionMonthPoint {
  label: string
  key: string
  aportes: number
}

export function aggregateContributionsByMonth(
  transactions: Transaction[],
  boards: TransactionBoard[],
  range: MonthBucket[],
): ContributionMonthPoint[] {
  return range.map(({ key, label, month, year }) => {
    const monthTx = transactions.filter(t => {
      const d = new Date(`${t.date}T12:00:00`)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })
    return { key, label, aportes: sumInvestmentContributions(monthTx, boards) }
  })
}
