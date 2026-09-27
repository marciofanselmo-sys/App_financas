'use client'

import { withPlan } from '@/components/plan/with-plan'
import type { Category, Transaction } from '@/types'

import { useState, useMemo, Fragment } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useRecurring } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useCategories } from '@/hooks/use-categories'
import { buildDisplayItems } from '@/lib/recurring-groups'
import { useSubcategoryNames } from '@/hooks/use-subcategory-names'
import { subKey } from '@/lib/plan-keys'
import { calcHealthScore, scoreConfig } from '@/components/dashboard/summary-cards'
import {
  Printer, CalendarDays, BarChart2, CreditCard, RefreshCw, CheckCircle,
  ChevronLeft, ChevronRight, ChevronsUpDown, TrendingUp, Tag,
} from 'lucide-react'
import { CategorySummary, PositionsBreakdown, ProventosBreakdown } from '@/components/investments/rico-position-summary'
import { BoardIcon } from '@/components/transactions/board-icon'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { installmentLabel } from '@/utils/format-installment'
import {
  aggregateYearMonths,
  buildYoYBalanceComparison,
  buildYoYIncomeComparison,
} from '@/lib/report-charts'
import { AnnualFlowChart, YoYComparisonChart } from '@/components/reports/annual-charts'
import { realMovements, internalTotals } from '@/lib/internal-movement'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(v)

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

type ReportType = 'mensal' | 'anual' | 'parcelas' | 'fixos' | 'investimentos'
const REPORT_TYPES: { id: ReportType; label: string; icon: React.ElementType }[] = [
  { id: 'mensal',        label: 'Mensal',       icon: CalendarDays },
  { id: 'anual',         label: 'Anual',        icon: BarChart2    },
  { id: 'parcelas',      label: 'Parcelas',     icon: CreditCard   },
  { id: 'fixos',         label: 'Gastos Fixos', icon: RefreshCw    },
  { id: 'investimentos', label: 'Investimentos',icon: TrendingUp   },
]

const now = new Date()

// ── Tokens de estilo reutilizados ─────────────────────────────────────────────
const card  = 'bg-white dark:bg-[#111c2d] print:bg-white border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl p-4'
const table = 'border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl overflow-x-auto print:overflow-visible [&_td.text-right]:whitespace-nowrap [&_th]:whitespace-nowrap'
const thead = 'bg-slate-50 dark:bg-slate-700/40 print:bg-slate-50'
const th    = 'text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wide'
const tdiv  = 'divide-y divide-slate-50 dark:divide-slate-700/50 print:divide-slate-100'
const tfoot = 'bg-slate-50 dark:bg-slate-700/30 print:bg-slate-50 font-bold border-t-2 border-slate-200 dark:border-slate-600 print:border-slate-200'
const secTitle = 'text-sm font-bold text-slate-600 dark:text-slate-300 print:text-slate-600 uppercase tracking-wide mb-3'

// ── Cabeçalho do relatório ────────────────────────────────────────────────────
function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 pb-4 border-b-2 border-slate-200 dark:border-slate-600 print:border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 print:text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 print:text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right text-xs text-slate-400 print:text-slate-400">
          <p className="font-heading font-bold text-[#0B2D6B] dark:text-slate-300 print:text-slate-600">NOBLI</p>
          <p>Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}

// ── Relatório Mensal ──────────────────────────────────────────────────────────
// ── Despesas por categoria (Mensal e Anual) ─────────────────────────────────
interface CategoryRow {
  name: string
  amount: number
  color: string
  subs: { name: string; amount: number }[]
}

// Soma pela categoria-mãe (lançamento em "Mercado" conta em "Alimentação")
// e guarda o detalhe por subcategoria dentro dela — mesma lógica da Análise.
function groupByMother(transactions: Transaction[], categories: Category[]): CategoryRow[] {
  const mothers = motherNameByCategory(categories)
  const map: Record<string, { total: number; subs: Record<string, number> }> = {}
  transactions.filter(t => t.type === 'despesa').forEach(t => {
    const amt = Number(t.amount)
    const mother = motherOf(t.category, mothers, t.type)
    const bucket = map[mother] ?? (map[mother] = { total: 0, subs: {} })
    bucket.total += amt
    if (t.category !== mother) bucket.subs[t.category] = (bucket.subs[t.category] ?? 0) + amt
  })
  return Object.entries(map)
    .map(([name, b]) => ({
      name,
      amount: b.total,
      color: categories.find(c => c.name === name)?.color ?? '#6b7280',
      subs: Object.entries(b.subs)
        .sort((x, y) => y[1] - x[1])
        .map(([sub, amount]) => ({ name: sub, amount })),
    }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Tabela de despesas por categoria com as subcategorias recolhíveis (fechadas
 * por padrão). `months` liga a coluna Média/mês (Anual); `limits` liga a
 * coluna Planejado (Mensal). No celular só cabem Categoria e Valor — o resto
 * vai numa linha pequena embaixo do valor.
 */
function CategoryTable({ title, rows, total, valueLabel, months, limits }: {
  title: string
  rows: CategoryRow[]
  total: number
  valueLabel: string
  months?: number
  limits?: Record<string, number>
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const withSubs = rows.filter(r => r.subs.length > 0)
  const allOpen = withSubs.length > 0 && withSubs.every(r => open.has(r.name))
  const pct = (v: number) => (total > 0 ? fmtPct(v / total) : '—')
  const limitOf = (key: string) => (limits?.[key] ? fmt(Number(limits[key])) : '—')

  function toggle(name: string) {
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const H = 'hidden sm:table-cell print:table-cell'
  const P = 'px-2.5 sm:px-4'

  function mobileExtra(amount: number, limitKey?: string) {
    const parts = [
      months ? `${fmt(amount / months)}/mês` : null,
      pct(amount),
      limits && limitKey && limits[limitKey] ? `plan. ${limitOf(limitKey)}` : null,
    ].filter(Boolean)
    return (
      <span className="block sm:hidden print:hidden text-[11px] font-normal text-slate-400 dark:text-slate-500">
        {parts.join(' · ')}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className={secTitle.replace("mb-3", "mb-0")}>{title}</h3>
        {withSubs.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(withSubs.map(r => r.name)))}
            className="print:hidden shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allOpen ? 'Ocultar subcategorias' : 'Mostrar subcategorias'}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 mb-3">
        Toque numa categoria para ver as subcategorias — elas já estão somadas no total dela.
        {months ? ` Média calculada sobre ${months} ${months === 1 ? 'mês' : 'meses'} com movimento.` : ''}
      </p>
      <div className={table}>
        <table className="w-full text-sm">
          <thead className={thead}>
            <tr>
              <th className={`text-left ${P} py-2.5 ${th}`}>Categoria</th>
              <th className={`text-right ${P} py-2.5 ${th}`}>{valueLabel}</th>
              {months && <th className={`${H} text-right ${P} py-2.5 ${th}`}>Média/mês</th>}
              <th className={`${H} text-right ${P} py-2.5 ${th}`}>% Total</th>
              {limits && <th className={`${H} text-right ${P} py-2.5 ${th}`}>Planejado</th>}
            </tr>
          </thead>
          <tbody className={tdiv}>
            {rows.map(cat => {
              const hasSubs = cat.subs.length > 0
              const isOpen = open.has(cat.name)
              return (
                <Fragment key={cat.name}>
                  <tr
                    onClick={hasSubs ? () => toggle(cat.name) : undefined}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${hasSubs ? 'cursor-pointer select-none' : ''}`}
                  >
                    <td className={`${P} py-2.5 font-medium text-slate-700 dark:text-slate-300 print:text-slate-700`}>
                      <div className="flex items-center gap-2">
                        {hasSubs
                          ? <ChevronRight className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform print:hidden ${isOpen ? 'rotate-90' : ''}`} />
                          : <span className="w-3.5 shrink-0 print:hidden" />}
                        <span>
                          {cat.name}
                          {hasSubs && !isOpen && (
                            <span className="ml-1.5 text-[11px] font-normal text-slate-400 dark:text-slate-500">({cat.subs.length})</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className={`${P} py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700`}>
                      {fmt(cat.amount)}
                      {mobileExtra(cat.amount, cat.name)}
                    </td>
                    {months && <td className={`${H} ${P} py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500`}>{fmt(cat.amount / months)}</td>}
                    <td className={`${H} ${P} py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500`}>{pct(cat.amount)}</td>
                    {limits && <td className={`${H} ${P} py-2.5 text-right text-slate-400 dark:text-slate-500 print:text-slate-400`}>{limitOf(cat.name)}</td>}
                  </tr>
                  {isOpen && cat.subs.map(sub => (
                    <tr key={`${cat.name}|${sub.name}`} className="bg-slate-50/50 dark:bg-slate-800/30 print:bg-white">
                      <td className="pl-12 sm:pl-14 pr-2.5 sm:pr-4 py-2 text-xs text-slate-500 dark:text-slate-400 print:text-slate-500">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                          {sub.name}
                        </div>
                      </td>
                      <td className={`${P} py-2 text-right text-xs text-slate-500 dark:text-slate-400 print:text-slate-500`}>
                        {fmt(sub.amount)}
                        {mobileExtra(sub.amount, subKey(sub.name))}
                      </td>
                      {months && <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{fmt(sub.amount / months)}</td>}
                      <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{pct(sub.amount)}</td>
                      {limits && <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{limitOf(subKey(sub.name))}</td>}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            <tr className={tfoot}>
              <td className={`${P} py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700`}>Total</td>
              <td className={`${P} py-2.5 text-right text-red-500`}>
                {fmt(total)}
                {mobileExtra(total)}
              </td>
              {months && <td className={`${H} ${P} py-2.5 text-right text-red-500`}>{fmt(total / months)}</td>}
              <td className={`${H} ${P} py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500`}>{pct(total)}</td>
              {limits && <td className={H} />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MonthlyReport({ month, year, boardId, excludeBoardIds }: { month: number; year: number; boardId: string; excludeBoardIds: string[] }) {
  const { transactions: allTransactions, loading } = useTransactions({
    month,
    year,
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  })
  const { plan } = useBudgetPlan(month, year)
  const { categories } = useCategories()

  // Movimentação entre contas do próprio usuário fica fora dos totais; o
  // rodapé mostra quanto foi, para nada sumir sem explicação.
  const transactions = useMemo(() => realMovements(allTransactions), [allTransactions])
  const internal = useMemo(() => internalTotals(allTransactions), [allTransactions])

  const income   = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  const balance  = income - expenses
  const score    = calcHealthScore(income, expenses)
  const { label: scoreLabel } = scoreConfig(score ?? 0)

  const byCategory = useMemo(
    () => groupByMother(transactions, categories).map(c => ({ ...c, pct: expenses > 0 ? c.amount / expenses : 0 })),
    [transactions, expenses, categories],
  )

  const categoryLimits = plan?.category_limits ?? {}
  const hasPlanned = Object.keys(categoryLimits).some(k => (categoryLimits[k] ?? 0) > 0)

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader
        title={`Relatório Mensal — ${MONTH_NAMES[month - 1]} ${year}`}
        subtitle={`${transactions.length} transações no período`}
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Receitas</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(income)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Despesas</p>
          <p className="text-lg font-bold text-red-500 mt-1">{fmt(expenses)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saldo</p>
          <p className={`text-lg font-bold mt-1 ${balance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>{fmt(balance)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saúde</p>
          <p className="text-lg font-bold text-purple-500 mt-1">{score}/100</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400">{scoreLabel}</p>
        </div>
      </div>

      {internal.count > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-500">
          Fora destes totais: {internal.count} lançamento{internal.count === 1 ? '' : 's'} de movimentação
          entre suas contas{internal.out > 0.005 ? ` (${fmt(internal.out)} de saída` : ''}
          {internal.in > 0.005 ? `${internal.out > 0.005 ? ' e ' : ' ('}${fmt(internal.in)} de entrada` : ''}
          {(internal.out > 0.005 || internal.in > 0.005) ? ')' : ''} — pagamento de fatura, transferência
          entre contas suas. Continuam no extrato e no saldo das contas.
        </p>
      )}

      {byCategory.length > 0 && (
        <CategoryTable
          title="Gastos por Categoria"
          rows={byCategory}
          total={expenses}
          valueLabel="Valor"
          limits={hasPlanned ? categoryLimits : undefined}
        />
      )}

      {/* Barras visuais */}
      {byCategory.length > 0 && (
        <div>
          <h3 className={secTitle}>Distribuição Visual</h3>
          <div className="space-y-2.5">
            {byCategory.slice(0, 8).map(cat => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="w-28 text-xs text-slate-600 dark:text-slate-400 print:text-slate-600 truncate shrink-0">{cat.name}</span>
                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 print:bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(cat.pct * 100, 1)}%`, backgroundColor: cat.color }} />
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 print:text-slate-700 w-24 text-right shrink-0">{fmt(cat.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transações */}
      {transactions.length > 0 && (
        <div>
          <h3 className={secTitle}>Transações ({transactions.length})</h3>
          <div className={table}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Data</th>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Parcelas</th>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Descrição</th>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Categoria</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Valor</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {transactions.slice(0, 50).map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap text-xs">
                      {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap text-xs">
                      {installmentLabel(t)}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300 print:text-slate-700 max-w-[200px] truncate">{t.description}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 text-xs">{t.category}</td>
                    <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-600' : 'text-red-500'}`}>
                      {t.type === 'receita' ? '+' : '-'}{fmt(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length > 50 && (
              <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-2 border-t border-slate-100 dark:border-slate-700 print:border-slate-100">
                Exibindo 50 de {transactions.length} transações
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Relatório Anual ───────────────────────────────────────────────────────────
// Valor com "R$" no desktop e na impressão; só o número no celular, onde o
// cabeçalho da tabela já diz a moeda.
const fmtNum = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
function Money({ v }: { v: number }) {
  return (
    <>
      <span className="sm:hidden print:hidden">{fmtNum(v)}</span>
      <span className="hidden sm:inline print:inline">{fmt(v)}</span>
    </>
  )
}

function AnnualReport({ year, boardId, excludeBoardIds }: { year: number; boardId: string; excludeBoardIds: string[] }) {
  const txFilters = {
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  }

  const { transactions: allTransactions, loading } = useTransactions({ year, ...txFilters })
  const { categories } = useCategories()
  const { transactions: prevTransactions, loading: prevLoading } = useTransactions({
    year: year - 1,
    ...txFilters,
  })

  const transactions = useMemo(() => realMovements(allTransactions), [allTransactions])
  const internal = useMemo(() => internalTotals(allTransactions), [allTransactions])

  const chartMonths = useMemo(() => aggregateYearMonths(transactions), [transactions])
  const prevChartMonths = useMemo(() => aggregateYearMonths(realMovements(prevTransactions)), [prevTransactions])
  const yoyBalance = useMemo(
    () => buildYoYBalanceComparison(chartMonths, prevChartMonths),
    [chartMonths, prevChartMonths],
  )
  const yoyIncome = useMemo(
    () => buildYoYIncomeComparison(chartMonths, prevChartMonths),
    [chartMonths, prevChartMonths],
  )

  const monthly = useMemo(() => {
    return chartMonths.map(m => ({
      month: m.month,
      income: m.receita,
      expenses: m.despesa,
      balance: m.saldo,
    }))
  }, [chartMonths])

  const byCategory = useMemo(() => groupByMother(transactions, categories), [transactions, categories])

  const totalIncome   = monthly.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0)
  const totalBalance  = totalIncome - totalExpenses
  const activeMonths  = monthly.filter(m => m.income > 0 || m.expenses > 0)
  // Média só pelos meses com movimento — dividir por 12 subestima o ano
  // corrente (ainda em andamento) e anos em que o uso começou no meio.
  const monthsForAvg  = Math.max(activeMonths.length, 1)
  const bestMonth     = activeMonths.length ? [...activeMonths].sort((a, b) => b.balance - a.balance)[0] : null
  const worstMonth    = activeMonths.length ? [...activeMonths].sort((a, b) => a.balance - b.balance)[0] : null

  if (loading || prevLoading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader title={`Relatório Anual — ${year}`} subtitle={`${transactions.length} transações no ano · comparativo com ${year - 1}`} />

      {internal.count > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-500">
          Fora destes totais: {internal.count} lançamento{internal.count === 1 ? '' : 's'} de movimentação
          entre suas contas{internal.out > 0.005 ? ` (${fmt(internal.out)} de saída` : ''}
          {internal.in > 0.005 ? `${internal.out > 0.005 ? ' e ' : ' ('}${fmt(internal.in)} de entrada` : ''}
          {(internal.out > 0.005 || internal.in > 0.005) ? ')' : ''} — pagamento de fatura, transferência
          entre contas suas. Continuam no extrato e no saldo das contas.
        </p>
      )}


      <AnnualFlowChart data={chartMonths} year={year} />
      <YoYComparisonChart
        balanceData={yoyBalance}
        incomeData={yoyIncome}
        currentYear={year}
        previousYear={year - 1}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Receitas totais</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totalIncome)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Despesas totais</p>
          <p className="text-lg font-bold text-red-500 mt-1">{fmt(totalExpenses)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saldo anual</p>
          <p className={`text-lg font-bold mt-1 ${totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>{fmt(totalBalance)}</p>
        </div>
      </div>

      {bestMonth && worstMonth && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 print:bg-emerald-50 print:border-emerald-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 uppercase tracking-wide">Melhor mês</p>
            <p className="font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-0.5">{MONTH_NAMES[bestMonth.month - 1]}</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 print:text-emerald-600">{fmt(bestMonth.balance)}</p>
          </div>
          <div className="border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 print:bg-amber-50 print:border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide">Mês mais apertado</p>
            <p className="font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-0.5">{MONTH_NAMES[worstMonth.month - 1]}</p>
            <p className="text-sm text-amber-600 dark:text-amber-400 print:text-amber-600">{fmt(worstMonth.balance)}</p>
          </div>
        </div>
      )}

      <div>
        <h3 className={secTitle}>Evolução Mensal <span className="sm:hidden normal-case font-normal text-slate-400">(R$)</span></h3>
        <div className={table}>
          <table className="w-full text-xs sm:text-sm">
            <thead className={thead}>
              <tr>
                <th className={`text-left px-2 sm:px-4 py-2.5 ${th}`}>Mês</th>
                <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Receitas</th>
                <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Despesas</th>
                <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Saldo</th>
              </tr>
            </thead>
            <tbody className={tdiv}>
              {monthly.map(m => (
                <tr key={m.month} className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${m.income === 0 && m.expenses === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-2 sm:px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">
                    <span className="sm:hidden print:hidden capitalize">{MONTH_SHORT[m.month - 1]}</span>
                    <span className="hidden sm:inline print:inline">{MONTH_NAMES[m.month - 1]}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600 font-semibold">{m.income > 0 ? <Money v={m.income} /> : '—'}</td>
                  <td className="px-2 sm:px-4 py-2.5 text-right text-red-500 font-semibold">{m.expenses > 0 ? <Money v={m.expenses} /> : '—'}</td>
                  <td className={`px-2 sm:px-4 py-2.5 text-right font-bold ${m.balance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>
                    {m.income > 0 || m.expenses > 0 ? <Money v={m.balance} /> : '—'}
                  </td>
                </tr>
              ))}
              <tr className={tfoot}>
                <td className="px-2 sm:px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total<span className="hidden sm:inline print:inline"> {year}</span></td>
                <td className="px-2 sm:px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600"><Money v={totalIncome} /></td>
                <td className="px-2 sm:px-4 py-2.5 text-right text-red-500"><Money v={totalExpenses} /></td>
                <td className={`px-2 sm:px-4 py-2.5 text-right ${totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}><Money v={totalBalance} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {byCategory.length > 0 && (
        <CategoryTable
          title="Despesas por Categoria no Ano"
          rows={byCategory}
          total={totalExpenses}
          valueLabel="Total"
          months={monthsForAvg}
        />
      )}
    </div>
  )
}

// ── Relatório de Parcelas ─────────────────────────────────────────────────────
function InstallmentsReport({ boardId, excludeBoardIds }: { boardId: string; excludeBoardIds: string[] }) {
  const { installments, loading } = useRecurring(
    boardId === 'all' ? excludeBoardIds : undefined,
    boardId !== 'all' ? boardId : undefined,
  )
  const active   = installments.filter(i => i.remaining > 0)
  const total    = active.reduce((s, i) => s + i.monthlyAmount * i.remaining, 0)
  const monthly  = active.reduce((s, i) => s + i.monthlyAmount, 0)
  const endLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTH_SHORT[parseInt(m) - 1]}/${y}` }

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader title="Relatório de Parcelas Futuras" subtitle={`${active.length} parcelamentos ativos`} />

      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Compromisso / mês</p>
          <p className="text-lg font-bold text-violet-600 dark:text-violet-400 print:text-violet-600 mt-1">{fmt(monthly)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Total comprometido</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-slate-800 mt-1">{fmt(total)}</p>
        </div>
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          iconColor="text-violet-500"
          iconBg="bg-violet-50 dark:bg-violet-500/15"
          title="Nenhum parcelamento ativo"
          description="Importe um extrato para que o app detecte parcelamentos automaticamente."
          primaryLabel="Importar extrato"
          primaryHref="/transactions"
        />
      ) : (
        <div className={table}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={`text-left px-4 py-2.5 ${th}`}>Descrição</th>
                <th className={`text-center px-4 py-2.5 ${th}`}>Parcelas</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Valor/mês</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Restantes</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Total futuro</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Término</th>
              </tr>
            </thead>
            <tbody className={tdiv}>
              {active.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-2.5 max-w-[180px]">
                    <div className="font-medium text-slate-700 dark:text-slate-200 print:text-slate-700 truncate">{item.description}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400">{item.category}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-500">{item.currentInstallment}/{item.totalInstallments}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(item.monthlyAmount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400 print:text-slate-600">{item.remaining}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-violet-600 dark:text-violet-400 print:text-violet-600">{fmt(item.monthlyAmount * item.remaining)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">{endLabel(item.endYearMonth)}</td>
                </tr>
              ))}
              <tr className={tfoot}>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700" colSpan={2}>Total</td>
                <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(monthly)}</td>
                <td />
                <td className="px-4 py-2.5 text-right text-violet-600 dark:text-violet-400 print:text-violet-600">{fmt(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Relatório de Gastos Fixos ─────────────────────────────────────────────────
function FixedChargesReport({ boardId, excludeBoardIds }: { boardId: string; excludeBoardIds: string[] }) {
  const { recurring, loading } = useRecurring(
    boardId === 'all' ? excludeBoardIds : undefined,
    boardId !== 'all' ? boardId : undefined,
  )
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()
  const { categories } = useCategories()
  const subcategoryNames = useSubcategoryNames()

  function categoryColor(name: string): string {
    return categories.find(c => c.name === name)?.color ?? '#94a3b8'
  }

  // "Gastos Fixos" é só despesa — recorrência também detecta receita e
  // transferência (usadas em /fixos), mas esse relatório é especificamente de gasto.
  // Mesmo motor de agrupamento/média de /fixos (buildDisplayItems) — antes esse
  // relatório tinha uma cópia própria e desatualizada dessa lógica, com a
  // mesma diluição de média de grupo já corrigida em /fixos em 2026-07-09.
  const despesaRecurring = useMemo(() => recurring.filter(r => r.type === 'despesa'), [recurring])
  const allItems   = useMemo(() => buildDisplayItems(despesaRecurring, new Map(), subcategoryNames), [despesaRecurring, subcategoryNames])
  const confirmed  = allItems.filter(i => decisions.get(i.key) === 'confirmed')
  const pending    = allItems.filter(i => !decisions.has(i.key))
  const totalMonthly = confirmed.reduce((s, i) => s + i.avgAmount, 0)
  const fmtDate      = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

  // Um item agrupado hoje é uma subcategoria (Aluguel, Internet): mostra o
  // caminho completo dela, "Moradia › Aluguel".
  function categoryCell(item: ReturnType<typeof buildDisplayItems>[number]) {
    const name = item.isGroup ? (item.subcategory ?? item.category) : item.category
    if (!name) return '—'
    const cat = categories.find(c => c.name === name)
    const mother = cat?.parent_id ? categories.find(m => m.id === cat.parent_id) : null
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700/50 text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: categoryColor(name) }} />
        {mother ? `${mother.name} › ${name}` : name}
      </span>
    )
  }

  if (loading || decisionsLoading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Relatório de Gastos Fixos"
        subtitle={`${confirmed.length} ${confirmed.length === 1 ? 'gasto confirmado' : 'gastos confirmados'} como fixo`}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Total fixo / mês</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totalMonthly)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Estimativa anual</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-slate-800 mt-1">{fmt(totalMonthly * 12)}</p>
        </div>
      </div>

      {confirmed.length > 0 && (
        <div>
          <h3 className={`${secTitle} flex items-center gap-2`}>
            <CheckCircle className="h-4 w-4 text-emerald-500" /> Confirmados como Fixo
          </h3>
          <div className={table}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Descrição</th>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Categoria</th>
                  <th className={`text-center px-4 py-2.5 ${th}`}>Detec.</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Última</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Média/mês</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {confirmed.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">
                      <div className="font-medium">{item.name}</div>
                      {item.isGroup && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{item.descriptions.join(', ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-slate-500 text-xs">{categoryCell(item)}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-500">{item.monthsCount}x</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">{fmtDate(item.lastDate)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(item.avgAmount)}</td>
                  </tr>
                ))}
                <tr className={tfoot}>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700" colSpan={4}>Total</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(totalMonthly)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sugestões ainda não revisadas ficam só em /fixos — o relatório mostra
          apenas o que o usuário confirmou como fixo. */}
      {confirmed.length === 0 && (
        pending.length > 0 ? (
          <EmptyState
            icon={RefreshCw}
            iconColor="text-sky-500"
            iconBg="bg-sky-50 dark:bg-sky-500/15"
            title="Nenhum gasto fixo confirmado"
            description={`Há ${pending.length} ${pending.length === 1 ? 'sugestão' : 'sugestões'} de gasto fixo para revisar. Confirme as que são fixas para elas aparecerem aqui.`}
            primaryLabel="Revisar gastos fixos"
            primaryHref="/fixos"
          />
        ) : (
          <EmptyState
            icon={RefreshCw}
            iconColor="text-sky-500"
            iconBg="bg-sky-50 dark:bg-sky-500/15"
            title="Nenhuma cobrança fixa detectada"
            description="O app detecta automaticamente despesas que aparecem em 2+ meses. Importe seus extratos para começar."
            primaryLabel="Importar extrato"
            primaryHref="/transactions"
          />
        )
      )}
    </div>
  )
}

// ── Relatório de Investimentos ────────────────────────────────────────────────
// Resumo da aba Investimentos: patrimônio, posições e rendimentos previstos da
// última posição importada. Entram as contas fixadas (alfinete em /investments);
// selecionar uma conta específica no filtro mostra ela mesmo sem estar fixada.
function InvestmentsReport({ boardId }: { boardId: string }) {
  const { boards, loading } = useTransactionBoards()

  const investmentBoards = useMemo(() => {
    const all = boards.filter(b => b.is_investment)
    if (boardId !== 'all') {
      const selected = all.filter(b => b.id === boardId)
      if (selected.length > 0) return selected
    }
    return all.filter(b => b.show_on_dashboard)
  }, [boards, boardId])

  const totals = useMemo(() => {
    let patrimonio = 0, investido = 0, saldo = 0, proventos = 0
    investmentBoards.forEach(b => {
      const p = b.last_position_import
      if (!p) return
      patrimonio += p.patrimonio
      investido += p.totalInvestido
      saldo += p.saldoDisponivel
      proventos += (p.proventos ?? []).reduce((s, pr) => s + pr.netValue, 0)
    })
    return { patrimonio, investido, saldo, proventos }
  }, [investmentBoards])

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  if (investmentBoards.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nenhuma conta de investimento nos relatórios"
        description="Fixe uma conta na aba Investimentos (ícone de alfinete) para incluí-la aqui, ou selecione uma conta específica no filtro acima."
        primaryLabel="Ir para Investimentos"
        primaryHref="/investments"
      />
    )
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Relatório de Investimentos"
        subtitle={`${investmentBoards.length} conta${investmentBoards.length > 1 ? 's' : ''} • posição da última importação`}
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Patrimônio total</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 print:text-blue-600 mt-1">{fmt(totals.patrimonio)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Total investido</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-1">{fmt(totals.investido)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saldo disponível</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-1">{fmt(totals.saldo)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Rendimentos previstos</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totals.proventos)}</p>
        </div>
      </div>

      {/* Detalhe por conta */}
      {investmentBoards.map(b => (
        <div key={b.id}>
          <p className={secTitle}>{b.name}</p>
          <div className={card}>
            {b.last_position_import ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: b.color + '20' }}>
                      <BoardIcon icon={b.icon} className="h-4 w-4" style={{ color: b.color }} />
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400">
                      Posição importada em {new Date(b.last_position_import.importedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400">Patrimônio</p>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100 print:text-slate-800">{fmt(b.last_position_import.patrimonio)}</p>
                  </div>
                </div>
                {b.last_position_import.positions.length > 0 && (
                  <>
                    <CategorySummary positions={b.last_position_import.positions} />
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700 print:border-slate-200">
                      <PositionsBreakdown positions={b.last_position_import.positions} />
                    </div>
                  </>
                )}
                {b.last_position_import.proventos && b.last_position_import.proventos.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 print:border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-slate-500 mb-2">Próximos Rendimentos</p>
                    <ProventosBreakdown proventos={b.last_position_import.proventos} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 print:text-slate-400 py-2">
                Nenhuma posição importada ainda — importe na aba Investimentos para ver o resumo aqui.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
function ReportsPage() {
  const [type, setType] = useState<ReportType>('mensal')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [boardId, setBoardId] = useState<string>('all')

  const { boards } = useTransactionBoards()
  // Conta de investimento nunca entra nos agregados de Mensal/Anual/Parcelas/
  // Fixos (aporte não é gasto) — ela tem a aba própria "Investimentos", onde o
  // alfinete de /investments controla quem aparece.
  const excludeBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards]
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Relatórios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visualize e exporte relatórios do período desejado</p>
        </div>
        <Button onClick={() => window.print()} size="lg" className="gap-2 shrink-0">
          <Printer className="h-5 w-5" />
          Exportar PDF
        </Button>
      </div>

      {/* Dica de exportação PDF */}
      <div className="print:hidden flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5">
        <Printer className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Como salvar em PDF</p>
          <p><strong>macOS:</strong> clique em &quot;Exportar PDF&quot; → na janela de impressão clique em &quot;PDF&quot; (canto inferior esquerdo) → &quot;Salvar como PDF&quot;.</p>
          <p><strong>Windows:</strong> clique em &quot;Exportar PDF&quot; → selecione a impressora &quot;Microsoft Print to PDF&quot; → &quot;Imprimir&quot;.</p>
        </div>
      </div>

      {/* Controles */}
      <div className="print:hidden space-y-3">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl overflow-x-auto">
          {REPORT_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                // A lista de contas do filtro muda entre a aba Investimentos e as
                // demais — reseta a seleção ao cruzar pra não filtrar por uma
                // conta que nem aparece no dropdown.
                if ((id === 'investimentos') !== (type === 'investimentos')) setBoardId('all')
                setType(id)
              }}
              className={`flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                type === id
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {type === 'mensal' && (
            <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          )}
          {type === 'anual' && (
            <div className="flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-sm">
              <button
                onClick={() => setYear(y => y - 1)}
                className="flex items-center justify-center h-9 w-9 rounded-l-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[52px] text-center">{year}</span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="flex items-center justify-center h-9 w-9 rounded-r-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          <select
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Todas as contas</option>
            {boards.filter(b => type === 'investimentos' ? b.is_investment : !b.is_investment).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white dark:bg-[#111c2d] print:bg-white rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] print:border-0 print:shadow-none p-3 sm:p-6 print:p-0">
        {type === 'mensal'   && <MonthlyReport month={month} year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'anual'    && <AnnualReport year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'parcelas' && <InstallmentsReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'fixos'    && <FixedChargesReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'investimentos' && <InvestmentsReport boardId={boardId} />}
      </div>
    </div>
  )
}

export default withPlan(
  'reports',
  ReportsPage,
  'Relatórios prontos para imprimir ou virar PDF, com o mês fechado, comparação com o ano anterior e os gastos fixos.',
)
