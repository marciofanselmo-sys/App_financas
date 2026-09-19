import { Transaction, Category } from '@/types'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { toLocalISO } from '@/utils/local-date'
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
  // toLocalISO, não toISOString: o segundo converte para UTC e, em fuso
  // positivo, devolve o dia anterior — o último dia do mês ficaria de fora.
  return toLocalISO(new Date(year, month, 0))
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

/**
 * Saldo acumulado em contas ao fim de cada mês.
 *
 * `openingBalance` é a soma do saldo inicial das contas consideradas — o que
 * existia antes do primeiro lançamento importado. Ele vale desde o começo da
 * série, então entra em TODOS os pontos.
 *
 * Sem isso, quem usa o saldo inicial (porque importou só uma fatia do
 * histórico) via o card da conta com o valor certo e o gráfico inteiro
 * deslocado pelo mesmo montante — o número de hoje batia, a curva não.
 */
export function aggregateCashBalanceTrend(
  transactions: Transaction[],
  range: MonthBucket[],
  openingBalance = 0,
): CashBalancePoint[] {
  return range.map(({ month, year, label, key }) => {
    const endDate = lastDayOfMonth(year, month)
    const saldo = openingBalance + balanceFromTransactions(transactions.filter(t => t.date <= endDate))
    return { label, key, saldo }
  })
}

export interface ChartSegment {
  name: string
  value: number
  color?: string
}

export interface PatrimonyChartData {
  /** O que o usuário TEM: contas com saldo positivo e investimentos. Vai no gráfico. */
  assets: ChartSegment[]
  /**
   * O que o usuário DEVE: contas com saldo negativo (cartão com fatura em
   * aberto, conta no negativo). `value` é o quanto se deve, sempre positivo —
   * quem exibe coloca o sinal.
   */
  debts: ChartSegment[]
  /** assets − debts. Fecha com o "Patrimônio total" do card de cima. */
  net: number
}

/**
 * Separa o patrimônio entre o que se tem e o que se deve.
 *
 * Antes tudo ia para o mesmo gráfico com Math.abs(): um cartão devendo
 * R$ 478 virava uma fatia de +R$ 478 do patrimônio. O gráfico de rosca não
 * desenha valor negativo, e o abs "resolvia" isso trocando o significado do
 * número — dívida aparecia como dinheiro do usuário, e as fatias somavam mais
 * do que o patrimônio real mostrado logo acima.
 */
export function buildPatrimonyChartData(overview: PatrimonyOverview): PatrimonyChartData {
  const assets: ChartSegment[] = []
  const debts: ChartSegment[] = []

  const place = (name: string, value: number, color: string) => {
    if (value > 0.005) assets.push({ name, value, color })
    else if (value < -0.005) debts.push({ name, value: -value, color })
  }

  // Cartão de crédito fica fora: o gráfico mostra onde o dinheiro está
  // (contas correntes e investimentos), não o que ainda vai ser pago.
  for (const b of overview.cashBreakdown) {
    if (!b.isCreditCard) place(b.name, b.balance, b.color)
  }
  place('Sem conta', overview.unassignedCash, '#94a3b8')
  for (const inv of overview.investments) place(inv.name, inv.patrimonio, '#2563EB')

  assets.sort((a, b) => b.value - a.value)
  debts.sort((a, b) => b.value - a.value)

  const net = assets.reduce((s, a) => s + a.value, 0) - debts.reduce((s, d) => s + d.value, 0)
  return { assets, debts, net }
}

// Soma pela categoria-mãe quando a lista de categorias é passada: sem isso o
// gráfico vira dezenas de fatias de subcategoria.
export function buildExpenseChartData(transactions: Transaction[], categories: Category[] = []): ChartSegment[] {
  const mothers = motherNameByCategory(categories)
  const map: Record<string, number> = {}
  transactions
    .filter(t => t.type === 'despesa')
    .forEach(t => {
      const name = motherOf(t.category, mothers)
      map[name] = (map[name] || 0) + Number(t.amount)
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

/** Paleta NOBLI: azul lidera (marca), acentos entram depois para distinguir categorias. */
export const CHART_COLORS = [
  '#2563EB', '#10b981', '#60A5FA', '#f59e0b',
  '#0B2D6B', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899',
]

export function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
