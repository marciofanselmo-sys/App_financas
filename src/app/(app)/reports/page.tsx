'use client'

import { withPlan } from '@/components/plan/with-plan'
import { PlanGate } from '@/components/plan/plan-gate'
import Link from 'next/link'
import { usePlan } from '@/hooks/use-subscription'
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
  Printer, CalendarDays, BarChart2, CreditCard, RefreshCw, Lock,
  ChevronLeft, ChevronRight, ChevronsUpDown, TrendingUp, Tag,
  AlertTriangle, ArrowUp, CheckCircle2, Star, PieChart, Receipt, List as ListIcon, ArrowLeftRight, Info,
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
import { CategoryIcon, categoryIconKey, guessIconKey } from '@/lib/category-icons'
import { Kpi, OverviewSection } from '@/components/ui/overview-blocks'

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

// A pergunta que cada relatório responde (os demais ganham a sua ao serem refeitos).
const REPORT_QUESTIONS: Partial<Record<ReportType, [string, string]>> = {
  mensal: ['Como foi o meu mês?', 'Quanto entrou, quanto saiu, onde passou do planejado e o que mudou em relação ao mês anterior.'],
}

const now = new Date()

// ── Tokens de estilo reutilizados ─────────────────────────────────────────────
const card  = 'bg-white dark:bg-[#111c2d] print:bg-white border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl p-3 sm:p-4 print:p-4'
const table = 'border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl overflow-x-auto print:overflow-visible [&_td.text-right]:whitespace-nowrap [&_th]:whitespace-nowrap'
const thead = 'bg-slate-50 dark:bg-slate-700/40 print:bg-slate-50'
const th    = 'text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wide'
const tdiv  = 'divide-y divide-slate-50 dark:divide-slate-700/50 print:divide-slate-100'
const tfoot = 'bg-slate-50 dark:bg-slate-700/30 print:bg-slate-50 font-bold border-t-2 border-slate-200 dark:border-slate-600 print:border-slate-200'
const secTitle = 'text-sm font-bold text-slate-600 dark:text-slate-300 print:text-slate-600 uppercase tracking-wide mb-3'

// ── Cabeçalho do relatório ────────────────────────────────────────────────────
function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 sm:mb-6 print:mb-6 pb-3 sm:pb-4 print:pb-4 border-b-2 border-slate-200 dark:border-slate-600 print:border-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl print:text-xl font-bold text-slate-800 dark:text-slate-100 print:text-slate-800">{title}</h2>
          <p className="text-xs sm:text-sm print:text-sm text-slate-500 dark:text-slate-400 print:text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {/* Marca e data só interessam no PDF e no computador */}
        <div className="hidden sm:block print:block text-right text-xs text-slate-400 print:text-slate-400 shrink-0">
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
  /** `note`: detalhe pequeno embaixo do nome (ex.: "11x · última 07/09/2026"). */
  subs: { name: string; amount: number; note?: string }[]
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
function CategoryTable({ title, rows, total, valueLabel, months, limits, hint, subLabel = 'subcategorias', iconOf }: {
  /** Liga o ícone da categoria (no padrão da Análise) e a coluna de uso do limite. */
  iconOf?: (name: string) => string
  title: string
  hint?: string
  subLabel?: string
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
      <div className={`flex items-center gap-2 mb-3 ${title ? 'justify-between' : 'justify-end'}`}>
        {title && <h3 className={secTitle.replace("mb-3", "mb-0")}>{title}</h3>}
        {withSubs.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(withSubs.map(r => r.name)))}
            className="print:hidden shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allOpen ? `Ocultar ${subLabel}` : `Mostrar ${subLabel}`}
          </button>
        )}
      </div>
      <p className={`text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 mb-3 ${hint === '' && !months ? 'hidden' : ''}`}>
        {hint ?? 'Toque numa categoria para ver as subcategorias — elas já estão somadas no total dela.'}
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
              {limits && iconOf && <th className={`hidden md:table-cell print:table-cell ${P} py-2.5 ${th} text-left`}>Uso do limite</th>}
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
                        {iconOf && (
                          <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}1f`, color: cat.color }}>
                            <CategoryIcon iconKey={iconOf(cat.name)} className="h-3.5 w-3.5" />
                          </span>
                        )}
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
                    {limits && iconOf && (
                      <td className={`hidden md:table-cell print:table-cell ${P} py-2.5`}>
                        <LimitUsage spent={cat.amount} limit={Number(limits[cat.name] ?? 0)} />
                      </td>
                    )}
                  </tr>
                  {isOpen && cat.subs.map((sub, i) => (
                    <tr key={`${cat.name}|${sub.name}|${i}`} className="bg-slate-50/50 dark:bg-slate-800/30 print:bg-white">
                      <td className="pl-12 sm:pl-14 pr-2.5 sm:pr-4 py-2 text-xs text-slate-500 dark:text-slate-400 print:text-slate-500">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            {sub.name}
                            {sub.note && <span className="block text-[11px] text-slate-400 dark:text-slate-500">{sub.note}</span>}
                          </span>
                        </div>
                      </td>
                      <td className={`${P} py-2 text-right text-xs text-slate-500 dark:text-slate-400 print:text-slate-500`}>
                        {fmt(sub.amount)}
                        {mobileExtra(sub.amount, subKey(sub.name))}
                      </td>
                      {months && <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{fmt(sub.amount / months)}</td>}
                      <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{pct(sub.amount)}</td>
                      {limits && <td className={`${H} ${P} py-2 text-right text-xs text-slate-400 dark:text-slate-500 print:text-slate-400`}>{limitOf(subKey(sub.name))}</td>}
                      {limits && iconOf && <td className="hidden md:table-cell print:table-cell" />}
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
              {limits && <td className={`${H} ${P} py-2.5 text-right text-slate-400 dark:text-slate-500 print:text-slate-400`}>{fmt(Object.entries(limits).filter(([k]) => rows.some(r => r.name === k)).reduce((s2, [, v]) => s2 + Number(v), 0))}</td>}
              {limits && iconOf && <td className="hidden md:table-cell print:table-cell" />}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Barra de uso do limite planejado + etiqueta (estourou / perto / ok).
function LimitUsage({ spent, limit }: { spent: number; limit: number }) {
  if (!(limit > 0)) return <span className="text-[11px] text-slate-300 dark:text-slate-600">sem limite</span>
  const use = (spent / limit) * 100
  const state = use > 100 ? 'over' : use > 90 ? 'near' : 'ok'
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/[0.08] print:bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${state === 'over' ? 'bg-red-500' : state === 'near' ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(use, 100)}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
        state === 'over' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          : state === 'near' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      }`}>
        {state === 'over' ? 'estourou' : state === 'near' ? 'perto' : 'ok'}
      </span>
    </div>
  )
}

// Variação contra o mês anterior, colorida pelo que é bom para cada número.
function Delta({ now: cur, prev, upIsGood, label }: { now: number; prev: number; upIsGood: boolean; label: string }) {
  if (!(Math.abs(prev) > 0.005)) return <p className="text-[11px] text-slate-400 mt-0.5">Sem {label} para comparar</p>
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  const up = pct >= 0
  const good = up === upIsGood
  return (
    <p className="text-[11px] text-slate-400 mt-0.5">
      <span className={good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%</span>
      {' '}vs {label} ({fmt(prev)})
    </p>
  )
}

type Highlight = { tone: 'bad' | 'warn' | 'good' | 'info'; strong: string; text: string }
const HIGHLIGHT_STYLE: Record<Highlight['tone'], { icon: React.ElementType; cls: string }> = {
  bad:  { icon: AlertTriangle, cls: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  warn: { icon: ArrowUp,       cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  good: { icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  info: { icon: Star,          cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
}

function MonthlyReport({ month, year, boardId, excludeBoardIds }: { month: number; year: number; boardId: string; excludeBoardIds: string[] }) {
  const filters = {
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  }
  const { transactions: allTransactions, loading } = useTransactions({ month, year, ...filters })
  // Mês anterior, só para as comparações dos números e dos destaques.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { transactions: prevAll } = useTransactions({ month: prevMonth, year: prevYear, ...filters })
  const { plan } = useBudgetPlan(month, year)
  const { categories } = useCategories()
  // Fixo = confirmado em Recorrências (mesmo agrupamento de /fixos) ou marcado no lançamento.
  const { recurring } = useRecurring(boardId === 'all' ? excludeBoardIds : undefined, boardId !== 'all' ? boardId : undefined)
  const { decisions } = useRecurringDecisions()
  const subcategoryNames = useSubcategoryNames()
  const fixedDescriptions = useMemo(() => {
    const set = new Set<string>()
    for (const item of buildDisplayItems(recurring.filter(r => r.type === 'despesa'), new Map(), subcategoryNames)) {
      if (decisions.get(item.key) !== 'confirmed') continue
      for (const d of item.descriptions) set.add(d.toLowerCase().trim())
    }
    return set
  }, [recurring, decisions, subcategoryNames])
  const [showAll, setShowAll] = useState(false)
  const [showInternal, setShowInternal] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Movimentação entre contas do próprio usuário fica fora dos totais; o
  // bloco recolhido mostra quanto foi, para nada sumir sem explicação.
  const transactions = useMemo(() => realMovements(allTransactions), [allTransactions])
  const internal = useMemo(() => internalTotals(allTransactions), [allTransactions])
  const prev = useMemo(() => realMovements(prevAll), [prevAll])

  const sum = (list: Transaction[], type: string) => list.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)
  const income = sum(transactions, 'receita')
  const expenses = sum(transactions, 'despesa')
  const balance = income - expenses
  const prevIncome = sum(prev, 'receita')
  const prevExpenses = sum(prev, 'despesa')
  const score = calcHealthScore(income, expenses)
  const prevScore = calcHealthScore(prevIncome, prevExpenses)
  const { label: scoreLabel } = scoreConfig(score ?? 0)
  const savedPct = income > 0 ? Math.round((balance / income) * 100) : null
  const prevSavedPct = prevIncome > 0 ? Math.round(((prevIncome - prevExpenses) / prevIncome) * 100) : null
  const prevName = MONTH_NAMES[prevMonth - 1].toLowerCase()

  const byCategory = useMemo(
    () => groupByMother(transactions, categories).map(c => ({ ...c, pct: expenses > 0 ? c.amount / expenses : 0 })),
    [transactions, expenses, categories],
  )
  const iconOf = (name: string) => {
    const cat = categories.find(c => !c.parent_id && c.name === name && c.type !== 'receita') ?? categories.find(c => c.name === name)
    return cat ? categoryIconKey(cat, categories) : guessIconKey(name)
  }

  const categoryLimits = plan?.category_limits ?? {}
  const hasPlanned = Object.keys(categoryLimits).some(k => (categoryLimits[k] ?? 0) > 0)

  // Para onde foi o dinheiro: parcela, fixo (marcado em Recorrências) ou escolha do mês.
  const despesas = transactions.filter(t => t.type === 'despesa')
  const parcelas = despesas.filter(t => installmentLabel(t)).reduce((s, t) => s + Number(t.amount), 0)
  const fixos = despesas
    .filter(t => !installmentLabel(t) && (t.is_recurring || fixedDescriptions.has(t.description.toLowerCase().trim())))
    .reduce((s, t) => s + Number(t.amount), 0)
  const variaveis = Math.max(0, expenses - parcelas - fixos)
  const biggest = [...despesas].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)

  // Destaques automáticos: o saldo, o que passou do planejado e o que foi bem.
  const highlights: Highlight[] = []
  if (income > 0 || expenses > 0) {
    highlights.push(balance < 0
      ? { tone: 'bad', strong: `Saiu ${fmt(-balance)} a mais do que entrou.`, text: 'As despesas passaram das receitas neste mês.' }
      : { tone: 'good', strong: `Sobraram ${fmt(balance)}.`, text: savedPct !== null ? `${savedPct}% do que entrou ficou com você.` : '' })
  }
  if (hasPlanned) {
    const over = byCategory
      .map(c => ({ c, limit: Number(categoryLimits[c.name] ?? 0) }))
      .filter(x => x.limit > 0 && x.c.amount > x.limit)
      .sort((a, b) => (b.c.amount - b.limit) - (a.c.amount - a.limit))
    if (over.length > 0) {
      const first = over[0]
      const extra = over[1] ? ` ${over[1].c.name} também: ${fmt(over[1].c.amount)} de ${fmt(over[1].limit)}.` : ''
      highlights.push({ tone: 'warn', strong: `${first.c.name} estourou o planejado`, text: `em ${fmt(first.c.amount - first.limit)} (${Math.round((first.c.amount / first.limit) * 100)}%).${extra}` })
    }
    const under = byCategory
      .map(c => ({ c, limit: Number(categoryLimits[c.name] ?? 0) }))
      .filter(x => x.limit > 0 && x.c.amount < x.limit * 0.6)
      .sort((a, b) => (b.limit - b.c.amount) - (a.limit - a.c.amount))
      .slice(0, 2)
    if (under.length > 0) {
      const left = under.reduce((s, x) => s + (x.limit - x.c.amount), 0)
      highlights.push({ tone: 'good', strong: `${under.map(x => x.c.name).join(' e ')} ${under.length > 1 ? 'ficaram' : 'ficou'} bem abaixo do planejado`, text: `— sobraram ${fmt(left)}.` })
    }
  }
  if (highlights.length < 3 && byCategory[0]) {
    highlights.push({ tone: 'info', strong: `${byCategory[0].name} foi a maior despesa:`, text: `${fmt(byCategory[0].amount)}, ${Math.round(byCategory[0].pct * 100)}% de tudo que saiu.` })
  }

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-5">
      <ReportHeader
        title={`Relatório Mensal — ${MONTH_NAMES[month - 1]} ${year}`}
        subtitle={`${transactions.length} transações no período`}
      />

      {/* Os 4 números, com as cores de sempre e a comparação com o mês anterior */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Receitas" value={fmt(income)} valueClass="text-emerald-600 dark:text-emerald-400 print:text-emerald-600">
          <Delta now={income} prev={prevIncome} upIsGood label={prevName} />
        </Kpi>
        <Kpi title="Despesas" value={fmt(expenses)} valueClass="text-red-500 dark:text-red-400 print:text-red-500">
          <Delta now={expenses} prev={prevExpenses} upIsGood={false} label={prevName} />
        </Kpi>
        <Kpi title="Saldo" value={fmt(balance)} valueClass={balance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500 dark:text-red-400 print:text-red-500'}>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {savedPct !== null ? `sobrou ${savedPct}% da renda` : 'sem receitas no mês'}
            {prevSavedPct !== null && ` · ${prevName}: ${prevSavedPct}%`}
          </p>
        </Kpi>
        <Kpi title="Saúde" value={score !== null ? `${score}/100` : '—'} valueClass="text-purple-600 dark:text-purple-400 print:text-purple-600">
          <p className="text-[11px] text-slate-400 mt-0.5">
            {score !== null ? scoreLabel : 'sem movimento'}
            {prevScore !== null && ` · ${prevName}: ${prevScore}/100`}
          </p>
        </Kpi>
      </div>

      {highlights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {highlights.slice(0, 3).map((h, i) => {
            const { icon: Icon, cls } = HIGHLIGHT_STYLE[h.tone]
            return (
              <div key={i} className="flex gap-3 rounded-2xl border border-slate-100 dark:border-white/[0.06] print:border-slate-200 bg-white dark:bg-[#111c2d] print:bg-white p-3.5">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${cls}`}><Icon className="h-3.5 w-3.5" /></span>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 print:text-slate-600">
                  <strong className="text-slate-800 dark:text-slate-100 print:text-slate-800">{h.strong}</strong>{h.text ? ' ' : ''}{h.text}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {byCategory.length > 0 && (
        <>
          <OverviewSection
            icon={BarChart2}
            title={hasPlanned ? 'Gastos por categoria × planejado' : 'Gastos por categoria'}
            subtitle="Toque numa categoria para ver as subcategorias — elas já estão somadas no total dela."
          >
            <div className="mt-3">
              <CategoryTable
                title=""
                hint=""
                rows={byCategory}
                total={expenses}
                valueLabel="Gasto"
                limits={hasPlanned ? categoryLimits : undefined}
                iconOf={iconOf}
              />
            </div>
          </OverviewSection>

          <div className="grid gap-4 md:grid-cols-2 items-start">
            <OverviewSection icon={PieChart} title="Para onde foi o dinheiro" subtitle="Fixos e parcelas já vinham comprometidos; o resto foi escolha do mês">
              {expenses > 0 && (
                <>
                  <div className="flex h-3.5 rounded-full overflow-hidden mt-4 bg-slate-100 dark:bg-white/[0.08]">
                    <div style={{ width: `${(fixos / expenses) * 100}%` }} className="bg-violet-700" />
                    <div style={{ width: `${(parcelas / expenses) * 100}%` }} className="bg-violet-400" />
                    <div style={{ width: `${(variaveis / expenses) * 100}%` }} className="bg-orange-500" />
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {([['Fixos', fixos, 'bg-violet-700'], ['Parcelas', parcelas, 'bg-violet-400'], ['Variáveis', variaveis, 'bg-orange-500']] as const).map(([l, v, c]) => (
                      <li key={l} className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${c}`} />
                        <span className="flex-1 text-slate-600 dark:text-slate-300 print:text-slate-600">{l}</span>
                        <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100 print:text-slate-800">{fmt(v)}</span>
                        <span className="tabular-nums text-slate-400 w-9 text-right">{Math.round((v / expenses) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </OverviewSection>

            <OverviewSection icon={Receipt} title="Maiores gastos do mês" subtitle="Os 5 lançamentos mais altos">
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
                {biggest.map(t => (
                  <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-700 dark:text-slate-200 print:text-slate-700">{t.description}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {t.category}
                        {installmentLabel(t) && ` · ${installmentLabel(t)}`}
                      </p>
                    </div>
                    <span className="tabular-nums font-semibold text-red-500 shrink-0">{fmt(Number(t.amount))}</span>
                  </li>
                ))}
              </ul>
            </OverviewSection>
          </div>
        </>
      )}

      {/* Todos os lançamentos — recolhido na tela, sempre aberto no PDF */}
      {transactions.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] print:border-0 bg-slate-50/70 dark:bg-white/[0.03] print:bg-white">
          <button type="button" onClick={() => setShowAll(v => !v)} aria-expanded={showAll} className="w-full flex items-center gap-2 p-4 text-left print:hidden">
            <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            <ListIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Todos os lançamentos ({transactions.length})</span>
          </button>
          <div className={`${showAll ? 'block' : 'hidden'} print:block px-4 pb-4 print:p-0`}>
            <h3 className={`${secTitle} hidden print:block`}>Transações ({transactions.length})</h3>
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
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors bg-white dark:bg-transparent">
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap text-xs">
                        {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap text-xs">{installmentLabel(t)}</td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300 print:text-slate-700 max-w-[260px] truncate">{t.description}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400 print:text-slate-500 text-xs">{t.category}</td>
                      <td className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-600' : 'text-red-500'}`}>
                        {t.type === 'receita' ? '+' : '-'}{fmt(Number(t.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {internal.count > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] print:border-0 bg-slate-50/70 dark:bg-white/[0.03] print:bg-white">
          <button type="button" onClick={() => setShowInternal(v => !v)} aria-expanded={showInternal} className="w-full flex items-center gap-2 p-4 text-left print:hidden">
            <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showInternal ? 'rotate-90' : ''}`} />
            <ArrowLeftRight className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Fora dos totais: {internal.count} movimentaç{internal.count === 1 ? 'ão' : 'ões'} entre suas contas
            </span>
          </button>
          <p className={`${showInternal ? 'block' : 'hidden'} print:block px-4 pb-4 print:p-0 text-xs text-slate-500 dark:text-slate-400 print:text-slate-500`}>
            {internal.out > 0.005 && <>{fmt(internal.out)} de saída</>}
            {internal.out > 0.005 && internal.in > 0.005 && ' e '}
            {internal.in > 0.005 && <>{fmt(internal.in)} de entrada</>}
            {' '}— pagamento de fatura e transferência entre contas suas. Continuam no extrato e no saldo das contas, mas não
            são gasto nem ganho, por isso ficam fora dos números acima.
          </p>
        </section>
      )}

      {/* Como ler este relatório — recolhido, fora do PDF */}
      <section className="print:hidden rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03]">
        <button type="button" onClick={() => setShowHelp(v => !v)} aria-expanded={showHelp} className="w-full flex items-center gap-2 p-4 text-left">
          <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showHelp ? 'rotate-90' : ''}`} />
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como ler este relatório</span>
        </button>
        {showHelp && (
          <ul className="px-4 pb-4 pl-10 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-disc">
            <li><strong className="text-slate-700 dark:text-slate-200">Receitas, Despesas e Saldo</strong> somam o mês e as contas escolhidas nos filtros, sem as movimentações entre suas contas. A setinha compara com o mês anterior.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Saúde</strong> vai de 0 a 100 e sobe quanto mais da renda sobra no mês.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Uso do limite</strong> compara o gasto com o planejado em Planejamento: <em>ok</em> até 90%, <em>perto</em> até 100% e <em>estourou</em> acima disso.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Fixos</strong> são os lançamentos marcados como fixo em Recorrências; <strong className="text-slate-700 dark:text-slate-200">Parcelas</strong>, as compras parceladas; o resto são os <strong className="text-slate-700 dark:text-slate-200">Variáveis</strong>.</li>
            <li>No PDF, a lista de lançamentos sai completa, mesmo que esteja recolhida aqui.</li>
          </ul>
        )}
      </section>
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

      {/* No celular: receitas e despesas lado a lado, saldo na linha inteira */}
      <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-2 sm:gap-3 [&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(3)]:col-span-1 print:[&>*:nth-child(3)]:col-span-1">
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Receitas totais</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totalIncome)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Despesas totais</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-red-500 mt-1">{fmt(totalExpenses)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saldo anual</p>
          <p className={`text-base sm:text-lg print:text-lg font-bold mt-1 ${totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>{fmt(totalBalance)}</p>
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
          <p className="text-base sm:text-lg print:text-lg font-bold text-violet-600 dark:text-violet-400 print:text-violet-600 mt-1">{fmt(monthly)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Total comprometido</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-slate-800 dark:text-slate-100 print:text-slate-800 mt-1">{fmt(total)}</p>
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
  const fmtDate      = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
  const totalMonthly = confirmed.reduce((s, i) => s + i.avgAmount, 0)

  // Mesma tabela do Mensal/Anual: cada gasto fixo fica dentro da
  // categoria-mãe dele (Internet, Aluguel e Luz dentro de Moradia).
  const byCategory: CategoryRow[] = (() => {
    const mothers = motherNameByCategory(categories)
    const map: Record<string, CategoryRow> = {}
    for (const item of confirmed) {
      const catName = (item.isGroup ? (item.subcategory ?? item.category) : item.category) || 'Outros'
      const mother = motherOf(catName, mothers, 'despesa')
      const row = map[mother] ?? (map[mother] = { name: mother, amount: 0, color: categoryColor(mother), subs: [] })
      row.amount += item.avgAmount
      row.subs.push({ name: item.name, amount: item.avgAmount, note: `${item.monthsCount}x · última ${fmtDate(item.lastDate)}` })
    }
    return Object.values(map)
      .map(r => ({ ...r, subs: [...r.subs].sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount)
  })()

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
          <p className="text-base sm:text-lg print:text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totalMonthly)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Estimativa anual</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-slate-800 dark:text-slate-100 print:text-slate-800 mt-1">{fmt(totalMonthly * 12)}</p>
        </div>
      </div>

      {confirmed.length > 0 && (
        <CategoryTable
          title="Confirmados como Fixo"
          rows={byCategory}
          total={totalMonthly}
          valueLabel="Média/mês"
          subLabel="gastos"
          hint="Toque numa categoria para ver os gastos fixos dela. Valores são a média mensal de cada gasto."
        />
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
          <p className="text-base sm:text-lg print:text-lg font-bold text-blue-600 dark:text-blue-400 print:text-blue-600 mt-1">{fmt(totals.patrimonio)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Total investido</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-1">{fmt(totals.investido)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Saldo disponível</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-slate-700 dark:text-slate-200 print:text-slate-700 mt-1">{fmt(totals.saldo)}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 uppercase tracking-wide font-semibold">Rendimentos previstos</p>
          <p className="text-base sm:text-lg print:text-lg font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-600 mt-1">{fmt(totals.proventos)}</p>
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
  const { can, loading: planLoading } = usePlan()
  // Relatórios além do mensal e o PDF dependem do plano; enquanto o plano
  // carrega, libera — o bloqueio nunca pisca.
  const podeVer = planLoading || type === 'mensal' || can('reportsFull')
  const podeExportar = planLoading || can('exportPdf')
  // Conta de investimento nunca entra nos agregados de Mensal/Anual/Parcelas/
  // Fixos (aporte não é gasto) — ela tem a aba própria "Investimentos", onde o
  // alfinete de /investments controla quem aparece.
  const excludeBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards]
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="print:hidden flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Relatórios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visualize e exporte relatórios do período desejado</p>
        </div>
        {podeExportar ? (
          podeVer && (
            <Button onClick={() => window.print()} className="gap-2 shrink-0 h-9 sm:h-10 px-3 sm:px-4">
              <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sm:hidden">PDF</span>
              <span className="hidden sm:inline">Exportar PDF</span>
            </Button>
          )
        ) : (
          <Link
            href="/settings/assinatura"
            title="Salvar relatórios em PDF está no plano Anual"
            className="inline-flex items-center gap-2 shrink-0 rounded-xl border border-slate-200 dark:border-white/[0.08] px-3 sm:px-4 h-9 sm:h-10 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            <Lock className="h-4 w-4" />
            <span className="sm:hidden">PDF</span>
            <span className="hidden sm:inline">Exportar PDF</span>
          </Link>
        )}
      </div>

      {/* Dica de exportação PDF */}
      {podeExportar && (
      <div className="print:hidden flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5">
        <Printer className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Como salvar em PDF</p>
          <p><strong>macOS:</strong> clique em &quot;Exportar PDF&quot; → na janela de impressão clique em &quot;PDF&quot; (canto inferior esquerdo) → &quot;Salvar como PDF&quot;.</p>
          <p><strong>Windows:</strong> clique em &quot;Exportar PDF&quot; → selecione a impressora &quot;Microsoft Print to PDF&quot; → &quot;Imprimir&quot;.</p>
        </div>
      </div>
      )}

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

        {REPORT_QUESTIONS[type] && (
          <div className="rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3">
            <p className="text-sm font-semibold text-[#0B2D6B] dark:text-blue-200">{REPORT_QUESTIONS[type]![0]}</p>
            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5">{REPORT_QUESTIONS[type]![1]}</p>
          </div>
        )}

        {/* Período e conta na mesma linha, também no celular */}
        <div className="flex items-center gap-2">
          {type === 'mensal' && (
            <div className="shrink-0">
              <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
            </div>
          )}
          {type === 'anual' && (
            <div className="shrink-0 flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-sm">
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
            className="flex-1 min-w-0 sm:flex-none h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
        {type !== 'mensal' && (
          <PlanGate
            feature="reportsFull"
            pitch="Veja o ano inteiro, as parcelas que ainda vão cair, seus gastos fixos e a carteira de investimentos."
          >
            {type === 'anual'    && <AnnualReport year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
            {type === 'parcelas' && <InstallmentsReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
            {type === 'fixos'    && <FixedChargesReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
            {type === 'investimentos' && <InvestmentsReport boardId={boardId} />}
          </PlanGate>
        )}
      </div>
    </div>
  )
}

export default withPlan(
  'reports',
  ReportsPage,
  'Relatórios prontos para imprimir ou virar PDF, com o mês fechado, comparação com o ano anterior e os gastos fixos.',
)
