import { Transaction } from '@/types'
import { BudgetPlan } from '@/hooks/use-budget-plan'
import { isSubKey, subName } from '@/lib/plan-keys'
import { balanceFromTransactions, PatrimonyOverview } from '@/lib/dashboard-patrimony'

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface MonthBucket {
  month: number
  year: number
  key: string
  label: string
}

export function getMonthRange(endMonth: number, endYear: number, count: number): MonthBucket[] {
  const result: MonthBucket[] = []
  let m = endMonth
  let y = endYear
  for (let i = 0; i < count; i++) {
    result.unshift({
      month: m,
      year: y,
      key: `${y}-${String(m).padStart(2, '0')}`,
      label: `${MONTH_SHORT[m - 1]}/${String(y).slice(2)}`,
    })
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return result
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split('T')[0]
}

export interface MonthlyFlowPoint {
  label: string
  key: string
  receita: number
  despesa: number
}

export function aggregateMonthlyFlow(
  transactions: Transaction[],
  range: MonthBucket[],
): MonthlyFlowPoint[] {
  const map = new Map(
    range.map(r => [r.key, { label: r.label, key: r.key, receita: 0, despesa: 0 }]),
  )

  for (const t of transactions) {
    if (t.type === 'transferencia') continue
    const key = t.date.slice(0, 7)
    const bucket = map.get(key)
    if (!bucket) continue
    const amt = Number(t.amount)
    if (t.type === 'receita') bucket.receita += amt
    else bucket.despesa += amt
  }

  return range.map(r => map.get(r.key)!)
}

export interface CashBalancePoint {
  label: string
  key: string
  saldo: number
}

/** Saldo acumulado em contas ao fim de cada mês (transferências ignoradas). */
export function aggregateCashBalanceTrend(
  transactions: Transaction[],
  range: MonthBucket[],
): CashBalancePoint[] {
  return range.map(({ month, year, label, key }) => {
    const endDate = lastDayOfMonth(year, month)
    const saldo = balanceFromTransactions(transactions.filter(t => t.date <= endDate))
    return { label, key, saldo }
  })
}

export interface ChartSegment {
  name: string
  value: number
  color?: string
}

export function buildPatrimonyChartData(overview: PatrimonyOverview): ChartSegment[] {
  const segments: ChartSegment[] = []

  for (const b of overview.cashBreakdown) {
    if (b.balance !== 0) {
      segments.push({ name: b.name, value: Math.abs(b.balance), color: b.color })
    }
  }
  if (overview.unassignedCash !== 0) {
    segments.push({ name: 'Sem conta', value: Math.abs(overview.unassignedCash), color: '#94a3b8' })
  }
  for (const inv of overview.investments) {
    segments.push({ name: inv.name, value: inv.patrimonio, color: '#10b981' })
  }

  return segments.filter(s => s.value > 0)
}

export function buildExpenseChartData(transactions: Transaction[]): ChartSegment[] {
  const map: Record<string, number> = {}
  transactions
    .filter(t => t.type === 'despesa')
    .forEach(t => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount)
    })

  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export interface IncomeCommitmentSegment {
  name: string
  value: number
  color: string
}

export function buildIncomeCommitment(
  monthlyIncome: number,
  fixedTotal: number,
  installmentsTotal: number,
  totalExpenses: number,
): { segments: IncomeCommitmentSegment[]; hasIncome: boolean } {
  const otherExpenses = Math.max(0, totalExpenses - fixedTotal - installmentsTotal)
  const committed = fixedTotal + installmentsTotal + otherExpenses
  const available = Math.max(0, monthlyIncome - committed)

  if (monthlyIncome <= 0) {
    return {
      hasIncome: false,
      segments: [
        { name: 'Despesas', value: totalExpenses, color: '#ef4444' },
      ],
    }
  }

  const segments: IncomeCommitmentSegment[] = [
    { name: 'Fixos', value: fixedTotal, color: '#0ea5e9' },
    { name: 'Parcelas', value: installmentsTotal, color: '#8b5cf6' },
    { name: 'Variável', value: otherExpenses, color: '#f97316' },
    { name: 'Disponível', value: available, color: '#10b981' },
  ].filter(s => s.value > 0)

  return { segments, hasIncome: true }
}

export interface PlannedVsActualRow {
  label: string
  planned: number
  actual: number
}

export function buildPlannedVsActual(
  plan: BudgetPlan | null,
  transactions: Transaction[],
): PlannedVsActualRow[] {
  if (!plan?.category_limits) return []

  const actualByCategory: Record<string, number> = {}
  transactions
    .filter(t => t.type === 'despesa')
    .forEach(t => {
      actualByCategory[t.category] = (actualByCategory[t.category] || 0) + Number(t.amount)
    })

  const actualByGroupLabel: Record<string, number> = {}
  transactions
    .filter(t => t.type === 'despesa' && t.group_label)
    .forEach(t => {
      const label = t.group_label as string
      actualByGroupLabel[label] = (actualByGroupLabel[label] || 0) + Number(t.amount)
    })

  const rows: PlannedVsActualRow[] = []

  for (const [key, planned] of Object.entries(plan.category_limits)) {
    if (planned <= 0) continue
    const label = isSubKey(key) ? subName(key) : key
    const actual = isSubKey(key)
      ? (actualByGroupLabel[subName(key)] ?? 0)
      : (actualByCategory[key] ?? 0)
    rows.push({ label, planned, actual })
  }

  return rows
    .sort((a, b) => b.planned - a.planned)
    .slice(0, 6)
}

export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
]

export function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
