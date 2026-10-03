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
import { AnnualFlowChart, YoYBalanceChart, YoYIncomeChart, hasYearData } from '@/components/reports/annual-charts'
import { NewVsPaidChart, IncomeWeightChart } from '@/components/reports/installment-charts'
import { MonthAmountChart, MonthPercentChart } from '@/components/reports/month-charts'
import { buildPurchases, monthIdx } from '@/lib/installment-history'
import { extractInstallment } from '@/hooks/use-recurring'
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
  parcelas: ['Como é o meu hábito de parcelar?', 'Quanto você comprou parcelado no ano, quanto já pagou, quanto isso pesa na renda e o que costuma parcelar. Para o que ainda falta pagar, veja Cartões & Parcelas.'],
  fixos: ['Quanto o meu custo fixo pesou no ano?', 'O que você pagou de fato em gastos fixos, como isso evoluiu mês a mês e quais fixos subiram de preço. Para confirmar fixos e ver quando caem, use Recorrências.'],
  anual: ['Como está o meu ano?', 'O ano até aqui: quanto sobrou, os melhores e piores meses, como está em relação ao ano passado e onde o dinheiro vai.'],
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
      {/* hint === '' : quem usa já explica no título do card (Mensal/Anual novos). */}
      <p className={`text-xs text-slate-400 dark:text-slate-500 print:text-slate-400 mb-3 ${hint === '' ? 'hidden' : ''}`}>
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
              {limits && iconOf && <th className={`hidden md:table-cell print:table-cell ${P} py-2.5 ${th} text-center`}>Status</th>}
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
                      <td className={`hidden md:table-cell print:table-cell ${P} py-2.5 text-center`}>
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

// Etiqueta de uso do limite planejado (estourou / perto / ok).
function LimitUsage({ spent, limit }: { spent: number; limit: number }) {
  if (!(limit > 0)) return <span className="text-[11px] text-slate-300 dark:text-slate-600">sem limite</span>
  const use = (spent / limit) * 100
  const state = use > 100 ? 'over' : use > 90 ? 'near' : 'ok'
  return (
    <span
      title={`${Math.round(use)}% do planejado`}
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        state === 'over' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          : state === 'near' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      }`}
    >
      {state === 'over' ? 'estourou' : state === 'near' ? 'perto' : 'ok'}
    </span>
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
        // Tabela à esquerda; "Para onde foi" e "Maiores gastos" empilhados à direita.
        <div className="grid gap-4 min-[1360px]:grid-cols-[minmax(0,1fr)_320px] items-start">
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

          <div className="grid gap-4 grid-cols-1 md:max-[1359px]:grid-cols-2 items-start">
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
        </div>
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
            <li><strong className="text-slate-700 dark:text-slate-200">Status</strong> compara o gasto com o planejado em Planejamento: <em>ok</em> até 90%, <em>perto</em> até 100% e <em>estourou</em> acima disso.</li>
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
  const [showMonthly, setShowMonthly] = useState(false)
  const [showInternal, setShowInternal] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const transactions = useMemo(() => realMovements(allTransactions), [allTransactions])
  const prevReal = useMemo(() => realMovements(prevTransactions), [prevTransactions])
  const internal = useMemo(() => internalTotals(allTransactions), [allTransactions])

  // Até hoje: no ano corrente, parcela com data futura ainda não aconteceu —
  // fica só nos gráficos e na tabela mês a mês, marcada como prevista.
  const today = new Date()
  const todayISO = today.toLocaleDateString('en-CA')
  const isCurrentYear = year === today.getFullYear()
  const isFutureYear = year > today.getFullYear()
  const happened = useMemo(
    () => (isFutureYear ? [] : isCurrentYear ? transactions.filter(t => t.date <= todayISO) : transactions),
    [transactions, isCurrentYear, isFutureYear, todayISO],
  )
  // Mesmo período do ano anterior (até o mesmo dia), para a comparação ser justa.
  const prevSamePeriod = useMemo(() => {
    if (!isCurrentYear) return prevReal
    const cut = `${year - 1}${todayISO.slice(4)}`
    return prevReal.filter(t => t.date <= cut)
  }, [prevReal, isCurrentYear, year, todayISO])

  const chartMonths = useMemo(() => aggregateYearMonths(transactions), [transactions])
  const prevChartMonths = useMemo(() => aggregateYearMonths(prevReal), [prevReal])
  const yoyBalance = useMemo(() => buildYoYBalanceComparison(chartMonths, prevChartMonths), [chartMonths, prevChartMonths])
  const yoyIncome = useMemo(() => buildYoYIncomeComparison(chartMonths, prevChartMonths), [chartMonths, prevChartMonths])

  const sum = (list: Transaction[], type: string) => list.filter(t => t.type === type).reduce((acc, t) => acc + Number(t.amount), 0)
  const totalIncome = sum(happened, 'receita')
  const totalExpenses = sum(happened, 'despesa')
  const totalBalance = totalIncome - totalExpenses
  const prevIncome = sum(prevSamePeriod, 'receita')
  const prevExpenses = sum(prevSamePeriod, 'despesa')
  const score = calcHealthScore(totalIncome, totalExpenses)
  const prevScore = calcHealthScore(prevIncome, prevExpenses)
  const { label: scoreLabel } = scoreConfig(score ?? 0)
  const savedPct = totalIncome > 0 ? Math.round((totalBalance / totalIncome) * 100) : null
  const prevSavedPct = prevIncome > 0 ? Math.round(((prevIncome - prevExpenses) / prevIncome) * 100) : null

  // Mês fechado = já terminou. No ano corrente, o mês atual está em andamento.
  const lastClosed = isFutureYear ? 0 : isCurrentYear ? today.getMonth() : 12
  const monthStatus = (m: number) => (m <= lastClosed ? 'closed' : isCurrentYear && m === lastClosed + 1 ? 'current' : 'future')
  const closedMonths = chartMonths.filter(m => m.month <= lastClosed && (m.receita > 0 || m.despesa > 0))
  // Média pelos meses que já tiveram movimento (incluindo o atual, em andamento).
  const monthsForAvg = Math.max(chartMonths.filter(m => monthStatus(m.month) !== 'future' && (m.receita > 0 || m.despesa > 0)).length, 1)
  const bestMonth = closedMonths.length ? [...closedMonths].sort((x, y) => y.saldo - x.saldo)[0] : null
  const worstMonth = closedMonths.length ? [...closedMonths].sort((x, y) => x.saldo - y.saldo)[0] : null
  const committed = isCurrentYear ? transactions.filter(t => t.date > todayISO && t.type === 'despesa').reduce((acc, t) => acc + Number(t.amount), 0) : 0

  const byCategory = useMemo(() => groupByMother(happened, categories), [happened, categories])
  const iconOf = (name: string) => {
    const cat = categories.find(c => !c.parent_id && c.name === name && c.type !== 'receita') ?? categories.find(c => c.name === name)
    return cat ? categoryIconKey(cat, categories) : guessIconKey(name)
  }
  const prevLabel = String(year - 1)

  const highlights: Highlight[] = []
  if (bestMonth && worstMonth) {
    highlights.push({
      tone: 'info',
      strong: `Melhor mês: ${MONTH_NAMES[bestMonth.month - 1].toLowerCase()}`,
      text: `(${bestMonth.saldo >= 0 ? 'sobraram' : 'saldo de'} ${fmt(bestMonth.saldo)}). Mais apertado: ${MONTH_NAMES[worstMonth.month - 1].toLowerCase()} (${fmt(worstMonth.saldo)}).`,
    })
  }
  if (byCategory[0] && totalExpenses > 0) {
    highlights.push({
      tone: 'warn',
      strong: `${byCategory[0].name} é ${Math.round((byCategory[0].amount / totalExpenses) * 100)}% de tudo que você gastou`,
      text: `no ano — ${fmt(byCategory[0].amount / monthsForAvg)} por mês, em média.`,
    })
  }
  if (committed > 0.005) {
    highlights.push({ tone: 'bad', strong: `Até dezembro já há ${fmt(committed)} comprometidos`, text: 'em parcelas, antes de qualquer gasto novo.' })
  } else if (totalIncome > 0) {
    highlights.push(totalBalance >= 0
      ? { tone: 'good', strong: `Sobraram ${fmt(totalBalance)} no ano.`, text: savedPct !== null ? `${savedPct}% do que entrou ficou com você.` : '' }
      : { tone: 'bad', strong: `Saiu ${fmt(-totalBalance)} a mais do que entrou no ano.`, text: '' })
  }

  if (loading || prevLoading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  const periodNote = isCurrentYear
    ? `${lastClosed > 0 ? `Janeiro a ${MONTH_NAMES[lastClosed - 1].toLowerCase()} fechados · ` : ''}${MONTH_NAMES[lastClosed].toLowerCase()} em andamento · comparativo com ${prevLabel}`
    : `${happened.length} transações no ano · comparativo com ${prevLabel}`

  return (
    <div className="space-y-5">
      <ReportHeader title={`Relatório Anual — ${year}`} subtitle={periodNote} />

      {/* Os mesmos 4 números do Mensal, contra o mesmo período do ano anterior */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Receitas" value={fmt(totalIncome)} valueClass="text-emerald-600 dark:text-emerald-400 print:text-emerald-600">
          <p className="text-[11px] text-slate-400 mt-0.5">média de {fmt(totalIncome / monthsForAvg)}/mês</p>
          <Delta now={totalIncome} prev={prevIncome} upIsGood label={prevLabel} />
        </Kpi>
        <Kpi title="Despesas" value={fmt(totalExpenses)} valueClass="text-red-500 dark:text-red-400 print:text-red-500">
          <p className="text-[11px] text-slate-400 mt-0.5">média de {fmt(totalExpenses / monthsForAvg)}/mês</p>
          <Delta now={totalExpenses} prev={prevExpenses} upIsGood={false} label={prevLabel} />
        </Kpi>
        <Kpi title="Saldo" value={fmt(totalBalance)} valueClass={totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500 dark:text-red-400 print:text-red-500'}>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {savedPct !== null ? `sobrou ${savedPct}% da renda` : 'sem receitas no ano'}
            {prevSavedPct !== null && ` · ${prevLabel}: ${prevSavedPct}%`}
          </p>
        </Kpi>
        <Kpi title="Saúde" value={score !== null ? `${score}/100` : '—'} valueClass="text-purple-600 dark:text-purple-400 print:text-purple-600">
          <p className="text-[11px] text-slate-400 mt-0.5">
            {score !== null ? scoreLabel : 'sem movimento'}
            {prevScore !== null && ` · ${prevLabel}: ${prevScore}/100`}
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

      {/* Os três gráficos de sempre, um embaixo do outro, em largura total */}
      {hasYearData(chartMonths) && (
        <div className="space-y-4 print:hidden">
          <OverviewSection icon={BarChart2} title={`Receitas × Despesas — ${year}`} subtitle={isCurrentYear ? 'Meses à frente: só o que já está comprometido' : 'Cada mês do ano'}>
            <div className="mt-3"><AnnualFlowChart data={chartMonths} /></div>
          </OverviewSection>
          <OverviewSection icon={TrendingUp} title="Saldo mensal" subtitle={`${year} × ${prevLabel}`}>
            <div className="mt-3"><YoYBalanceChart data={yoyBalance} currentYear={year} previousYear={year - 1} /></div>
          </OverviewSection>
          <OverviewSection icon={BarChart2} iconClass="text-emerald-600 dark:text-emerald-400" title="Receitas" subtitle={`${year} × ${prevLabel}`}>
            <div className="mt-3"><YoYIncomeChart data={yoyIncome} currentYear={year} previousYear={year - 1} /></div>
          </OverviewSection>
        </div>
      )}

      {byCategory.length > 0 && (
        <OverviewSection
          icon={BarChart2}
          title="Despesas por categoria no ano"
          subtitle={`Toque numa categoria para ver as subcategorias. Média sobre ${monthsForAvg} ${monthsForAvg === 1 ? 'mês' : 'meses'} com movimento.`}
        >
          <div className="mt-3">
            <CategoryTable title="" hint="" rows={byCategory} total={totalExpenses} valueLabel="Total" months={monthsForAvg} iconOf={iconOf} />
          </div>
        </OverviewSection>
      )}

      {/* Evolução mensal — recolhida na tela, aberta no PDF */}
      <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] print:border-0 bg-slate-50/70 dark:bg-white/[0.03] print:bg-white">
        <button type="button" onClick={() => setShowMonthly(v => !v)} aria-expanded={showMonthly} className="w-full flex items-center gap-2 p-4 text-left print:hidden">
          <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showMonthly ? 'rotate-90' : ''}`} />
          <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Evolução mensal</span>
          <span className="text-xs text-slate-400">receitas, despesas e saldo de cada mês</span>
        </button>
        <div className={`${showMonthly ? 'block' : 'hidden'} print:block px-4 pb-4 print:p-0`}>
          <h3 className={`${secTitle} hidden print:block`}>Evolução mensal</h3>
          <div className={table}>
            <table className="w-full text-xs sm:text-sm bg-white dark:bg-transparent">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-2 sm:px-4 py-2.5 ${th}`}>Mês</th>
                  <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Receitas</th>
                  <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Despesas</th>
                  <th className={`text-right px-2 sm:px-4 py-2.5 ${th}`}>Saldo</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {chartMonths.map(m => {
                  const st = monthStatus(m.month)
                  const empty = m.receita === 0 && m.despesa === 0
                  return (
                    <tr key={m.month} className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${empty || st === 'future' ? 'opacity-50' : ''}`}>
                      <td className="px-2 sm:px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">
                        <span className="sm:hidden print:hidden capitalize">{MONTH_SHORT[m.month - 1]}</span>
                        <span className="hidden sm:inline print:inline">{MONTH_NAMES[m.month - 1]}</span>
                        {st === 'current' && <span className="ml-1.5 text-[10px] font-normal text-slate-400">em andamento</span>}
                        {st === 'future' && !empty && <span className="ml-1.5 text-[10px] font-normal text-slate-400">previsto</span>}
                      </td>
                      <td className="px-2 sm:px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600 font-semibold">{m.receita > 0 ? <Money v={m.receita} /> : '—'}</td>
                      <td className="px-2 sm:px-4 py-2.5 text-right text-red-500 font-semibold">{m.despesa > 0 ? <Money v={m.despesa} /> : '—'}</td>
                      <td className={`px-2 sm:px-4 py-2.5 text-right font-bold ${m.saldo >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>
                        {!empty ? <Money v={m.saldo} /> : '—'}
                      </td>
                    </tr>
                  )
                })}
                <tr className={tfoot}>
                  <td className="px-2 sm:px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total<span className="hidden sm:inline print:inline">{isCurrentYear ? ' até hoje' : ` ${year}`}</span></td>
                  <td className="px-2 sm:px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600"><Money v={totalIncome} /></td>
                  <td className="px-2 sm:px-4 py-2.5 text-right text-red-500"><Money v={totalExpenses} /></td>
                  <td className={`px-2 sm:px-4 py-2.5 text-right ${totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}><Money v={totalBalance} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

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

      <section className="print:hidden rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03]">
        <button type="button" onClick={() => setShowHelp(v => !v)} aria-expanded={showHelp} className="w-full flex items-center gap-2 p-4 text-left">
          <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showHelp ? 'rotate-90' : ''}`} />
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como ler este relatório</span>
        </button>
        {showHelp && (
          <ul className="px-4 pb-4 pl-10 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-disc">
            <li><strong className="text-slate-700 dark:text-slate-200">Receitas, Despesas e Saldo</strong> somam o ano até hoje, sem as movimentações entre suas contas. A setinha compara com o mesmo período do ano anterior.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Média por mês</strong> divide pelos meses que já tiveram movimento — meses que ainda não chegaram não entram.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Melhor mês e mês mais apertado</strong> consideram só meses que já terminaram.</li>
            <li>Nos gráficos e na evolução mensal, os meses à frente mostram só o que já está comprometido (parcelas), marcado como <em>previsto</em>.</li>
            <li>No PDF, a evolução mensal sai completa, mesmo recolhida aqui.</li>
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Relatório de Parcelas ─────────────────────────────────────────────────────
function InstallmentsReport({ year, boardId, excludeBoardIds }: { year: number; boardId: string; excludeBoardIds: string[] }) {
  const { transactions: allTransactions, loading } = useTransactions({
    year,
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  })
  const { categories } = useCategories()
  const [showHelp, setShowHelp] = useState(false)

  const today = new Date()
  const todayISO = today.toLocaleDateString('en-CA')
  const isCurrentYear = year === today.getFullYear()
  const lastMonth = year > today.getFullYear() ? 0 : isCurrentYear ? today.getMonth() + 1 : 12
  const yearStart = year * 12

  // Só o que já aconteceu: parcela de mês futuro é compromisso, não pagamento.
  const happened = useMemo(
    () => realMovements(allTransactions).filter(t => t.date <= todayISO),
    [allTransactions, todayISO],
  )
  const purchases = useMemo(() => buildPurchases(realMovements(allTransactions), todayISO), [allTransactions, todayISO])
  // Compras que começaram neste ano (até hoje).
  const started = purchases.filter(p => p.startIdx >= yearStart && p.startIdx < yearStart + lastMonth)
  const paidTx = happened.filter(t => t.type === 'despesa' && extractInstallment(t))

  const bought = started.reduce((acc, p) => acc + p.full, 0)
  const paid = paidTx.reduce((acc, t) => acc + Number(t.amount), 0)
  const income = happened.filter(t => t.type === 'receita').reduce((acc, t) => acc + Number(t.amount), 0)
  const weight = income > 0 ? (paid / income) * 100 : null
  const avgTerm = started.length ? Math.round(started.reduce((acc, p) => acc + p.total, 0) / started.length) : 0
  const ticket = started.length ? bought / started.length : 0
  const stillActive = started.filter(p => p.paidNow < p.total).length

  const months = useMemo(() => Array.from({ length: lastMonth }, (_, i) => {
    const idx = yearStart + i
    const inMonth = (t: Transaction) => monthIdx(t.date) === idx
    const pagoM = paidTx.filter(inMonth).reduce((acc, t) => acc + Number(t.amount), 0)
    const rendaM = happened.filter(t => t.type === 'receita' && inMonth(t)).reduce((acc, t) => acc + Number(t.amount), 0)
    return {
      label: MONTH_SHORT[i].charAt(0).toUpperCase() + MONTH_SHORT[i].slice(1),
      novas: started.filter(p => p.startIdx === idx).reduce((acc, p) => acc + p.full, 0),
      pago: pagoM,
      peso: rendaM > 0 ? Math.round((pagoM / rendaM) * 1000) / 10 : 0,
    }
  }), [lastMonth, yearStart, paidTx, happened, started])

  // O que você costuma parcelar: valor cheio das compras por categoria (subcategorias dentro da mãe).
  const byCategory = useMemo(
    () => groupByMother(started.map(p => ({ type: 'despesa', category: p.category, amount: p.full }) as Transaction), categories),
    [started, categories],
  )
  const iconOf = (name: string) => {
    const cat = categories.find(c => !c.parent_id && c.name === name && c.type !== 'receita') ?? categories.find(c => c.name === name)
    return cat ? categoryIconKey(cat, categories) : guessIconKey(name)
  }
  const idxLabel = (idx: number) => `${MONTH_SHORT[idx % 12]}/${String(Math.floor(idx / 12)).slice(2)}`

  const highlights: Highlight[] = []
  const peak = [...months].sort((x, y) => y.novas - x.novas)[0]
  if (peak && peak.novas > 0) {
    const n = started.filter(p => MONTH_SHORT[p.startIdx % 12] === peak.label.toLowerCase()).length
    highlights.push({ tone: 'warn', strong: `${MONTH_NAMES[MONTH_SHORT.indexOf(peak.label.toLowerCase())]} foi o mês que mais parcelou:`, text: `${fmt(peak.novas)} em ${n} compra${n === 1 ? '' : 's'}.` })
  }
  if (byCategory[0] && bought > 0) {
    highlights.push({ tone: 'info', strong: `${byCategory[0].name} é o que você mais parcela`, text: `— ${Math.round((byCategory[0].amount / bought) * 100)}% do valor comprado parcelado no ano.` })
  }
  const finished = purchases.filter(p => p.paidNow >= p.total && p.startIdx + p.total - 1 >= yearStart)
  if (finished.length > 0) {
    highlights.push({ tone: 'good', strong: `${finished.length} compra${finished.length === 1 ? '' : 's'} quitada${finished.length === 1 ? '' : 's'} no ano`, text: `— ${fmt(finished.reduce((acc, p) => acc + p.monthly, 0))} que deixaram de sair por mês.` })
  } else if (weight !== null) {
    highlights.push({ tone: weight > 20 ? 'bad' : 'good', strong: `Parcelas levaram ${weight.toFixed(0)}% das receitas do ano.`, text: weight > 20 ? 'Acima de 20% costuma apertar o mês.' : '' })
  }

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  const list = [...started].sort((x, y) => y.startIdx - x.startIdx || y.full - x.full)

  return (
    <div className="space-y-5">
      <ReportHeader
        title={`Relatório de Parcelas — ${year}`}
        subtitle={`${started.length} compra${started.length === 1 ? '' : 's'} parcelada${started.length === 1 ? '' : 's'} no ano · ${stillActive} ainda em andamento`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Comprado parcelado" value={fmt(bought)} valueClass="text-violet-600 dark:text-violet-400 print:text-violet-600">
          <p className="text-[11px] text-slate-400 mt-0.5">{started.length} compra{started.length === 1 ? '' : 's'} · valor cheio</p>
        </Kpi>
        <Kpi title="Já pago em parcelas" value={fmt(paid)} valueClass="text-red-500 dark:text-red-400 print:text-red-500">
          <p className="text-[11px] text-slate-400 mt-0.5">no ano · média de {fmt(lastMonth > 0 ? paid / lastMonth : 0)}/mês</p>
        </Kpi>
        <Kpi title="Peso na renda" value={weight !== null ? `${weight.toFixed(0)}%` : '—'}>
          <p className="text-[11px] text-slate-400 mt-0.5">das receitas do ano foi para parcelas</p>
        </Kpi>
        <Kpi title="Prazo médio" value={avgTerm ? `${avgTerm}x` : '—'}>
          <p className="text-[11px] text-slate-400 mt-0.5">{started.length ? `ticket médio de ${fmt(ticket)} por compra` : 'nenhuma compra parcelada no ano'}</p>
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

      {lastMonth > 0 && (paid > 0 || bought > 0) && (
        <div className="space-y-4 print:hidden">
          <OverviewSection icon={BarChart2} iconClass="text-violet-600 dark:text-violet-400" title="Quanto você parcelou × quanto pagou" subtitle="Roxo: compras novas no mês (valor cheio) · vermelho: parcelas pagas no mês">
            <div className="mt-3"><NewVsPaidChart data={months} /></div>
          </OverviewSection>
          <OverviewSection icon={TrendingUp} iconClass="text-violet-600 dark:text-violet-400" title="Peso das parcelas na renda" subtitle="Quanto das receitas de cada mês foi para parcelas">
            <div className="mt-3"><IncomeWeightChart data={months} /></div>
          </OverviewSection>
        </div>
      )}

      {byCategory.length > 0 && (
        <OverviewSection icon={BarChart2} title="O que você costuma parcelar" subtitle="Valor cheio das compras parceladas no ano, por categoria. Toque numa categoria para ver as subcategorias.">
          <div className="mt-3">
            <CategoryTable title="" hint="" rows={byCategory} total={bought} valueLabel="Valor" iconOf={iconOf} />
          </div>
        </OverviewSection>
      )}

      {list.length > 0 && (
        <OverviewSection icon={CreditCard} iconClass="text-violet-600 dark:text-violet-400" title="Compras parceladas no ano" subtitle="Cada compra com o valor cheio, em quantas vezes e a situação hoje">
          <div className={`${table} mt-3`}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Compra</th>
                  <th className={`text-left px-4 py-2.5 ${th} hidden sm:table-cell print:table-cell`}>Início</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Valor cheio</th>
                  <th className={`text-center px-4 py-2.5 ${th} hidden sm:table-cell print:table-cell`}>Vezes</th>
                  <th className={`text-center px-4 py-2.5 ${th}`}>Situação</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {list.map(p => {
                  const done = p.paidNow >= p.total
                  return (
                    <tr key={p.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-2.5 max-w-[260px]">
                        <p className="font-medium text-slate-700 dark:text-slate-200 print:text-slate-700 truncate">{p.description}</p>
                        <p className="text-[11px] text-slate-400">{p.category}<span className="sm:hidden"> · {idxLabel(p.startIdx)} · {p.total}x</span></p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs hidden sm:table-cell print:table-cell">{idxLabel(p.startIdx)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(p.full)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 hidden sm:table-cell print:table-cell">{p.total}x de {fmt(p.monthly)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${done
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {done ? 'quitada' : `${p.paidNow} de ${p.total}`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                <tr className={tfoot}>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total</td>
                  <td className="hidden sm:table-cell print:table-cell" />
                  <td className="px-4 py-2.5 text-right text-violet-600 dark:text-violet-400 print:text-violet-600">{fmt(bought)}</td>
                  <td className="hidden sm:table-cell print:table-cell" />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </OverviewSection>
      )}

      {started.length === 0 && paid === 0 && (
        <EmptyState
          icon={CreditCard}
          iconColor="text-violet-500"
          iconBg="bg-violet-50 dark:bg-violet-500/15"
          title="Nenhuma compra parcelada neste ano"
          description="Quando um extrato trouxer compras parceladas, o histórico delas aparece aqui."
          primaryLabel="Ver Cartões & Parcelas"
          primaryHref="/recurring"
        />
      )}

      <section className="print:hidden rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03]">
        <button type="button" onClick={() => setShowHelp(v => !v)} aria-expanded={showHelp} className="w-full flex items-center gap-2 p-4 text-left">
          <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showHelp ? 'rotate-90' : ''}`} />
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como ler este relatório</span>
        </button>
        {showHelp && (
          <ul className="px-4 pb-4 pl-10 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-disc">
            <li>Este relatório olha para <strong className="text-slate-700 dark:text-slate-200">o que já aconteceu</strong> no ano. Para o que ainda falta pagar e quando você fica livre, veja <Link href="/recurring" className="text-blue-600 dark:text-blue-400 hover:underline">Cartões & Parcelas</Link>.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Comprado parcelado</strong> é o valor cheio (parcela × vezes) das compras que começaram no ano.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Já pago em parcelas</strong> soma as parcelas que venceram no ano até hoje — inclusive de compras de anos anteriores.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Peso na renda</strong> é quanto das receitas foi para parcelas.</li>
            <li>A situação mostra quantas parcelas já venceram até hoje; <em>quitada</em> quando todas venceram.</li>
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Relatório de Gastos Fixos ─────────────────────────────────────────────────
function FixedChargesReport({ year, boardId, excludeBoardIds }: { year: number; boardId: string; excludeBoardIds: string[] }) {
  const filters = {
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  }
  const { transactions: allTransactions, loading } = useTransactions({ year, ...filters })
  const { recurring, loading: recLoading } = useRecurring(boardId === 'all' ? excludeBoardIds : undefined, boardId !== 'all' ? boardId : undefined)
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()
  const { categories } = useCategories()
  const subcategoryNames = useSubcategoryNames()
  const [showHelp, setShowHelp] = useState(false)

  const today = new Date()
  const todayISO = today.toLocaleDateString('en-CA')
  const isCurrentYear = year === today.getFullYear()
  const lastMonth = year > today.getFullYear() ? 0 : isCurrentYear ? today.getMonth() + 1 : 12
  const lastClosed = isCurrentYear ? lastMonth - 1 : lastMonth

  // Fixo = confirmado em Recorrências (mesmo agrupamento de /fixos) ou marcado
  // no lançamento. Cada descrição aponta para o fixo dela, para somar por item.
  const itemOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of buildDisplayItems(recurring.filter(r => r.type === 'despesa'), new Map(), subcategoryNames)) {
      if (decisions.get(item.key) !== 'confirmed') continue
      for (const d of item.descriptions) map.set(d.toLowerCase().trim(), item.name)
    }
    return map
  }, [recurring, decisions, subcategoryNames])

  const happened = useMemo(() => realMovements(allTransactions).filter(t => t.date <= todayISO), [allTransactions, todayISO])
  const fixedTx = useMemo(
    () => happened.filter(t => t.type === 'despesa' && !installmentLabel(t) && (itemOf.has(t.description.toLowerCase().trim()) || t.is_recurring)),
    [happened, itemOf],
  )
  const paid = fixedTx.reduce((acc, t) => acc + Number(t.amount), 0)
  const income = happened.filter(t => t.type === 'receita').reduce((acc, t) => acc + Number(t.amount), 0)
  const weight = income > 0 ? (paid / income) * 100 : null

  const months = Array.from({ length: lastMonth }, (_, i) => {
    const inMonth = (t: Transaction) => Number(t.date.slice(5, 7)) === i + 1
    const fixo = fixedTx.filter(inMonth).reduce((acc, t) => acc + Number(t.amount), 0)
    const renda = happened.filter(t => t.type === 'receita' && inMonth(t)).reduce((acc, t) => acc + Number(t.amount), 0)
    return {
      label: MONTH_SHORT[i].charAt(0).toUpperCase() + MONTH_SHORT[i].slice(1),
      fixo,
      peso: renda > 0 ? Math.round((fixo / renda) * 1000) / 10 : 0,
    }
  })
  const closed = months.slice(0, Math.max(lastClosed, 0)).filter(m => m.fixo > 0)
  const avgMonth = closed.length ? closed.reduce((acc, m) => acc + m.fixo, 0) / closed.length : 0
  // Variação: média dos 3 primeiros meses fechados × média dos 3 últimos —
  // um mês sozinho oscila demais (conta que atrasou, mês com 2 cobranças).
  const span = Math.min(3, Math.floor(closed.length / 2))
  const avgOf = (list: typeof closed) => list.reduce((acc, m) => acc + m.fixo, 0) / list.length
  const firstPart = span > 0 ? closed.slice(0, span) : []
  const lastPart = span > 0 ? closed.slice(-span) : []
  const firstAvg = firstPart.length ? avgOf(firstPart) : 0
  const lastAvg = lastPart.length ? avgOf(lastPart) : 0
  const trend = span > 0 && firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : null
  const periodLabel = (list: typeof closed) => list.length === 1 ? list[0].label.toLowerCase() : `${list[0].label.toLowerCase()}–${list[list.length - 1].label.toLowerCase()}`

  // Cada fixo no ano: quanto pagou, em quantos meses e se mudou de valor.
  const items = useMemo(() => {
    const map = new Map<string, { name: string; category: string; byMonth: Map<number, number> }>()
    for (const t of fixedTx) {
      const name = itemOf.get(t.description.toLowerCase().trim()) ?? t.description
      const it = map.get(name) ?? { name, category: t.category, byMonth: new Map<number, number>() }
      const m = Number(t.date.slice(5, 7))
      it.byMonth.set(m, (it.byMonth.get(m) ?? 0) + Number(t.amount))
      map.set(name, it)
    }
    return [...map.values()].map(it => {
      const vals = [...it.byMonth.entries()].sort((x, y) => x[0] - y[0]).map(e => e[1])
      // Mudança de preço só entre meses fechados — o mês atual pode estar pela metade.
      const closedVals = [...it.byMonth.entries()].filter(e => e[0] <= lastClosed).sort((x, y) => x[0] - y[0]).map(e => e[1])
      const total = vals.reduce((acc, v) => acc + v, 0)
      const last = closedVals[closedVals.length - 1]
      const before = closedVals.slice(0, -1)
      const prevAvg = before.length ? before.reduce((acc, v) => acc + v, 0) / before.length : null
      const change = prevAvg && prevAvg > 0 ? ((last - prevAvg) / prevAvg) * 100 : null
      return { ...it, total, monthsPaid: vals.length, avg: total / vals.length, change }
    }).sort((x, y) => y.total - x.total)
  }, [fixedTx, itemOf, lastClosed])

  const byCategory = useMemo(() => groupByMother(fixedTx, categories), [fixedTx, categories])
  const iconOf = (name: string) => {
    const cat = categories.find(c => !c.parent_id && c.name === name && c.type !== 'receita') ?? categories.find(c => c.name === name)
    return cat ? categoryIconKey(cat, categories) : guessIconKey(name)
  }
  const monthsForAvg = Math.max(months.filter(m => m.fixo > 0).length, 1)

  const highlights: Highlight[] = []
  if (trend !== null) {
    highlights.push({
      tone: trend > 5 ? 'warn' : 'good',
      strong: `Custo fixo ${trend > 5 ? 'subiu' : trend < -5 ? 'caiu' : 'ficou estável'}${Math.abs(trend) > 5 ? ` ${Math.abs(trend).toFixed(0)}%` : ''}`,
      text: `— média de ${fmt(firstAvg)}/mês em ${periodLabel(firstPart)} e ${fmt(lastAvg)}/mês em ${periodLabel(lastPart)}.`,
    })
  }
  const riser = items.filter(i => i.change !== null && i.change > 5).sort((x, y) => (y.change ?? 0) - (x.change ?? 0))[0]
  if (riser) {
    highlights.push({ tone: 'bad', strong: `${riser.name} subiu ${riser.change!.toFixed(0)}%`, text: `— a última cobrança veio acima da média dos meses anteriores.` })
  }
  if (byCategory[0] && paid > 0) {
    highlights.push({ tone: 'info', strong: `${byCategory[0].name} é ${Math.round((byCategory[0].amount / paid) * 100)}% do seu custo fixo`, text: `— ${fmt(byCategory[0].amount)} no ano.` })
  }

  if (loading || recLoading || decisionsLoading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  const changeTag = (c: number | null) => {
    if (c === null) return <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
    const cls = c > 5 ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      : c < -5 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{c > 5 ? `subiu ${c.toFixed(0)}%` : c < -5 ? `caiu ${Math.abs(c).toFixed(0)}%` : 'estável'}</span>
  }

  return (
    <div className="space-y-5">
      <ReportHeader
        title={`Relatório de Gastos Fixos — ${year}`}
        subtitle={`${items.length} gasto${items.length === 1 ? '' : 's'} fixo${items.length === 1 ? '' : 's'} pago${items.length === 1 ? '' : 's'} no ano${isCurrentYear ? ' · até hoje' : ''}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Pago em fixos" value={fmt(paid)} valueClass="text-red-500 dark:text-red-400 print:text-red-500">
          <p className="text-[11px] text-slate-400 mt-0.5">no ano{isCurrentYear ? ', até hoje' : ''}</p>
        </Kpi>
        <Kpi title="Média por mês" value={fmt(avgMonth)}>
          <p className="text-[11px] text-slate-400 mt-0.5">nos {closed.length} {closed.length === 1 ? 'mês fechado' : 'meses fechados'}</p>
        </Kpi>
        <Kpi title="Peso na renda" value={weight !== null ? `${weight.toFixed(0)}%` : '—'}>
          <p className="text-[11px] text-slate-400 mt-0.5">das receitas do ano foi para fixos</p>
        </Kpi>
        <Kpi title="Variação no ano" value={trend !== null ? `${trend >= 0 ? '+' : '−'}${Math.abs(trend).toFixed(0)}%` : '—'}
          valueClass={trend === null ? undefined : trend > 5 ? 'text-red-500 dark:text-red-400 print:text-red-500' : trend < -5 ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-600' : undefined}>
          <p className="text-[11px] text-slate-400 mt-0.5">{trend !== null ? `${periodLabel(firstPart)} → ${periodLabel(lastPart)}` : 'precisa de 2 meses fechados'}</p>
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

      {paid > 0 && (
        <div className="space-y-4 print:hidden">
          <OverviewSection icon={BarChart2} iconClass="text-red-500" title="Custo fixo mês a mês" subtitle="Quanto você pagou de gastos fixos em cada mês">
            <div className="mt-3"><MonthAmountChart data={months} dataKey="fixo" name="Gastos fixos" color="#ef4444" /></div>
          </OverviewSection>
          <OverviewSection icon={TrendingUp} title="Peso dos fixos na renda" subtitle="Quanto das receitas de cada mês foi para gastos fixos">
            <div className="mt-3"><MonthPercentChart data={months} dataKey="peso" name="Peso na renda" color="#a78bfa" /></div>
          </OverviewSection>
        </div>
      )}

      {byCategory.length > 0 && (
        <OverviewSection icon={BarChart2} title="Gastos fixos por categoria no ano" subtitle={`Toque numa categoria para ver as subcategorias. Média sobre ${monthsForAvg} ${monthsForAvg === 1 ? 'mês' : 'meses'} com pagamento.`}>
          <div className="mt-3">
            <CategoryTable title="" hint="" rows={byCategory} total={paid} valueLabel="Pago no ano" months={monthsForAvg} iconOf={iconOf} />
          </div>
        </OverviewSection>
      )}

      {items.length > 0 && (
        <OverviewSection icon={RefreshCw} title="Cada gasto fixo no ano" subtitle="Quanto pagou, em quantos meses e se a última cobrança mudou em relação às anteriores">
          <div className={`${table} mt-3`}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Gasto fixo</th>
                  <th className={`text-center px-4 py-2.5 ${th} hidden sm:table-cell print:table-cell`}>Meses pagos</th>
                  <th className={`text-right px-4 py-2.5 ${th} hidden sm:table-cell print:table-cell`}>Média</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Pago no ano</th>
                  <th className={`text-center px-4 py-2.5 ${th}`}>Última cobrança</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {items.map(it => (
                  <tr key={it.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 max-w-[260px]">
                      <p className="font-medium text-slate-700 dark:text-slate-200 print:text-slate-700 truncate">{it.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {it.category !== it.name && it.category}
                        <span className="sm:hidden">{it.category !== it.name ? ' · ' : ''}{it.monthsPaid} de {lastMonth} meses</span>
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 hidden sm:table-cell print:table-cell">{it.monthsPaid} de {lastMonth}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 hidden sm:table-cell print:table-cell">{fmt(it.avg)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(it.total)}</td>
                    <td className="px-4 py-2.5 text-center">{changeTag(it.change)}</td>
                  </tr>
                ))}
                <tr className={tfoot}>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total</td>
                  <td className="hidden sm:table-cell print:table-cell" />
                  <td className="hidden sm:table-cell print:table-cell" />
                  <td className="px-4 py-2.5 text-right text-red-500">{fmt(paid)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </OverviewSection>
      )}

      {items.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          iconColor="text-violet-500"
          iconBg="bg-violet-50 dark:bg-violet-500/15"
          title="Nenhum gasto fixo pago neste ano"
          description="Confirme seus gastos fixos em Recorrências para acompanhar o histórico deles aqui."
          primaryLabel="Ir para Recorrências"
          primaryHref="/fixos"
        />
      )}

      <section className="print:hidden rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03]">
        <button type="button" onClick={() => setShowHelp(v => !v)} aria-expanded={showHelp} className="w-full flex items-center gap-2 p-4 text-left">
          <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showHelp ? 'rotate-90' : ''}`} />
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como ler este relatório</span>
        </button>
        {showHelp && (
          <ul className="px-4 pb-4 pl-10 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 list-disc">
            <li>Este relatório olha para <strong className="text-slate-700 dark:text-slate-200">o que você pagou de fato</strong> no ano. Para confirmar fixos, ver quando cada um cai e quanto da renda já tem destino, use <Link href="/fixos" className="text-blue-600 dark:text-blue-400 hover:underline">Recorrências</Link>.</li>
            <li>Conta como fixo o lançamento confirmado como fixo em Recorrências (ou marcado como fixo no extrato). Parcelas ficam de fora — elas têm o relatório próprio.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Média por mês</strong> usa só meses que já terminaram. <strong className="text-slate-700 dark:text-slate-200">Variação no ano</strong> compara a média dos 3 primeiros meses fechados com a dos 3 últimos.</li>
            <li><strong className="text-slate-700 dark:text-slate-200">Última cobrança</strong> compara o último pagamento de cada fixo (em mês já fechado) com a média dos anteriores: <em>subiu</em> ou <em>caiu</em> acima de 5%, senão <em>estável</em>.</li>
          </ul>
        )}
      </section>
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
          {(type === 'anual' || type === 'parcelas' || type === 'fixos') && (
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
            {type === 'parcelas' && <InstallmentsReport year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
            {type === 'fixos'    && <FixedChargesReport year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
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
