'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useCategories } from '@/hooks/use-categories'
import {
  TrendingDown, TrendingUp, Wallet, BarChart2, Loader2, AlertCircle, CheckCircle2, X, ArrowLeftRight, ChevronRight, ChevronDown,
  ArrowRight, ArrowUpRight, ArrowDownRight, ChartPie, Lightbulb, type LucideIcon,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { EmptyState } from '@/components/ui/empty-state'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Category, Transaction } from '@/types'
import { useRules } from '@/hooks/use-rules'
import { categoriesForDate } from '@/lib/special-category-filter'
import { CategoryOptions } from '@/components/categories/category-options'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { isInternalMovement, internalTotals } from '@/lib/internal-movement'
import { installmentLabel } from '@/utils/format-installment'
import { aggregateDailyFlow } from '@/lib/analytics-charts'
import { DailyFlowChart } from '@/components/analytics/daily-flow-chart'
import { cn } from '@/lib/utils'
import { CategoryIcon, categoryIconKey, guessIconKey } from '@/lib/category-icons'

// Cor e ícone vêm da categoria-mãe (escolhidos em Categorias). "Outros" na
// rosca junta várias categorias, por isso fica cinza.
const OTHER_COLOR = '#94a3b8'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type CategoryTotal = {
  cat: string
  total: number
  count: number
  pct: number
  txs: Transaction[]
  subs: { name: string; total: number; count: number }[]
}

// Soma pela categoria-mãe e guarda o detalhe por subcategoria dentro dela.
// Movimentação entre contas do próprio usuário não é gasto nem ganho.
function summarize(transactions: Transaction[], categories: Category[]) {
  let totalIncome = 0
  let totalExpenses = 0
  const mothers = motherNameByCategory(categories)
  type Bucket = { total: number; count: number; txs: Transaction[]; subs: Record<string, { total: number; count: number }> }
  const expenseMap: Record<string, Bucket> = {}
  const incomeMap: Record<string, Bucket> = {}

  for (const t of transactions) {
    if (isInternalMovement(t)) continue
    const amt = Number(t.amount)
    const mother = motherOf(t.category, mothers, t.type)
    const target = t.type === 'receita' ? incomeMap : expenseMap
    if (t.type === 'receita') totalIncome += amt
    else totalExpenses += amt

    const bucket = target[mother] ?? (target[mother] = { total: 0, count: 0, txs: [], subs: {} })
    bucket.total += amt
    bucket.count += 1
    bucket.txs.push(t)
    if (t.category !== mother) {
      const sub = bucket.subs[t.category] ?? (bucket.subs[t.category] = { total: 0, count: 0 })
      sub.total += amt
      sub.count += 1
    }
  }

  const toList = (map: Record<string, Bucket>, total: number): CategoryTotal[] =>
    Object.entries(map)
      .map(([cat, d]) => ({
        cat,
        total: d.total,
        count: d.count,
        pct: total > 0 ? (d.total / total) * 100 : 0,
        txs: [...d.txs].sort((a, b) => b.date.localeCompare(a.date)),
        subs: Object.entries(d.subs)
          .map(([name, sd]) => ({ name, total: sd.total, count: sd.count }))
          .sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total)

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    expenseByCategory: toList(expenseMap, totalExpenses),
    incomeByCategory: toList(incomeMap, totalIncome),
  }
}

// Variação % contra o mês anterior; sem base de comparação, não mostra nada.
function change(current: number, previous: number) {
  if (Math.abs(previous) < 0.005) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function ChangeBadge({ value, upIsGood }: { value: number | null; upIsGood: boolean }) {
  if (value === null || !isFinite(value)) return null
  const up = value >= 0
  const good = up === upIsGood
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <div className="text-center lg:text-right shrink-0">
      <p className={cn(
        'inline-flex items-center gap-0.5 text-[10px] lg:text-xs font-semibold tabular-nums',
        good ? 'text-green-600 dark:text-green-400' : 'text-red-500',
      )}>
        <Icon className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
        {Math.abs(value).toFixed(0)}%
      </p>
      <p className="hidden lg:block text-[10px] text-slate-400 whitespace-nowrap">vs. mês anterior</p>
    </div>
  )
}

function CardHeading({ icon: Icon, title, subtitle, extra }: { icon: LucideIcon; title: string; subtitle: string; extra?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {extra}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">{subtitle}</p>
    </div>
  )
}

// Categoria-mãe pelo nome, do tipo certo (o mesmo nome pode existir em
// despesa e receita).
function findMother(categories: Category[], name: string, type: 'despesa' | 'receita') {
  const same = categories.filter(c => !c.parent_id && c.name === name)
  return same.find(c => c.type === type) ?? same.find(c => c.type === 'ambos') ?? same[0]
}

function buildColorMap(categories: Category[], type: 'despesa' | 'receita') {
  return (cat: string) => findMother(categories, cat, type)?.color ?? OTHER_COLOR
}

// Rosca: as 6 maiores e o resto somado em "Outros" (junto da própria Outros).
function buildDonut(list: CategoryTotal[], colorOf: (cat: string) => string) {
  const top = list.filter(c => c.cat.toLowerCase() !== 'outros').slice(0, 6)
  const rest = list.filter(c => !top.includes(c)).reduce((s, c) => s + c.total, 0)
  const items = top.map(c => ({ name: c.cat, value: c.total, color: colorOf(c.cat) }))
  if (rest > 0.005) items.push({ name: 'Outros', value: rest, color: OTHER_COLOR })
  return items
}

function DonutCard({ title, items, total }: { title: string; items: { name: string; value: number; color: string }[]; total: number }) {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
      <CardHeading icon={ChartPie} title={title} subtitle={`Total: ${fmt(total)}`} />
      <div className="flex items-center gap-4">
        <div className="relative h-36 w-36 shrink-0 [&_path]:stroke-white dark:[&_path]:stroke-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="100%"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {items.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip
                formatter={(value) => fmt(Number(value))}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 min-w-0 space-y-1.5">
          {items.map(d => (
            <li key={d.name} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">{d.name}</span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function AnalyticsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [boardId, setBoardId] = useState<string>('all')
  // Categoria aberta na lista, mostrando os lançamentos dela ali mesmo.
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  // Começa sempre recolhido ao abrir a tela.
  const [internalOpen, setInternalOpen] = useState(false)
  const toggleInternal = () => setInternalOpen(v => !v)
  const [incomeOpen, setIncomeOpen] = useState(false)

  const { boards } = useTransactionBoards()
  const { categories } = useCategories()
  // Investimento nunca entra no analytics, mesmo fixado — o alfinete de
  // conta de investimento só inclui a conta nos Relatórios.
  const unpinnedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards]
  )
  const { syncCategoryToRule } = useRules()
  const [savingTxId, setSavingTxId] = useState<string | null>(null)
  const [ruleSyncError, setRuleSyncError] = useState<string | null>(null)
  const [ruleSyncSuccess, setRuleSyncSuccess] = useState<{ category: string; applied: number } | null>(null)

  const boardFilter = {
    board_id: boardId === 'all' ? undefined : boardId,
    exclude_board_ids: boardId === 'all' ? unpinnedBoardIds : undefined,
  }
  const { transactions, loading, updateTransaction, refetch } = useTransactions({ month, year, ...boardFilter })
  // Mês anterior, só para a comparação dos cards e o insight.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { transactions: prevTransactions } = useTransactions({ month: prevMonth, year: prevYear, ...boardFilter })

  const { totalIncome, totalExpenses, balance, expenseByCategory, incomeByCategory } = useMemo(
    () => summarize(transactions, categories),
    [transactions, categories],
  )
  const prev = useMemo(() => summarize(prevTransactions, categories), [prevTransactions, categories])
  const hasPrev = prevTransactions.some(t => !isInternalMovement(t))

  const maxExpense = expenseByCategory[0]?.total ?? 1

  // Cor por categoria (a da categoria-mãe), separada para despesas e receitas.
  const expenseColor = useMemo(() => buildColorMap(categories, 'despesa'), [categories])
  const incomeColor = useMemo(() => buildColorMap(categories, 'receita'), [categories])
  const colorOf = expenseColor

  const donut = useMemo(() => buildDonut(expenseByCategory, expenseColor), [expenseByCategory, expenseColor])
  const incomeDonut = useMemo(() => buildDonut(incomeByCategory, incomeColor), [incomeByCategory, incomeColor])

  // Insight: a categoria que mais subiu em reais contra o mês anterior.
  const insight = useMemo(() => {
    const prevByCat = new Map(prev.expenseByCategory.map(c => [c.cat, c.total]))
    let best: { cat: string; pct: number; diff: number } | null = null
    for (const c of expenseByCategory) {
      const p = prevByCat.get(c.cat) ?? 0
      if (p <= 0) continue
      const diff = c.total - p
      if (diff > 0.005 && (!best || diff > best.diff)) best = { cat: c.cat, pct: (diff / p) * 100, diff }
    }
    return best
  }, [expenseByCategory, prev])
  const monthInProgress = month === now.getMonth() + 1 && year === now.getFullYear()

  function openCategory(cat: string) {
    setExpandedCat(`despesa:${cat}`)
    setTimeout(() => document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function handleRecategorize(txId: string, newCategory: string) {
    const tx = transactions.find(t => t.id === txId)
    setSavingTxId(txId)
    await updateTransaction(txId, { category: newCategory })
    // Categoria normal: "gruda" em todas as transações com esse nome exato via
    // também entra normalmente (decisão revertida em 2026-07-08).
    if (tx) {
      setRuleSyncSuccess(null)
      const syncResult = await syncCategoryToRule(tx.description, newCategory, categories)
      if (syncResult.error) {
        console.error('[handleRecategorize] syncCategoryToRule falhou:', syncResult.error)
        setRuleSyncError(syncResult.error)
      } else {
        setRuleSyncError(null)
        setRuleSyncSuccess({ category: newCategory, applied: syncResult.applied })
      }
      refetch()
    }
    setSavingTxId(null)
  }

  // Um lançamento numa linha: data, descrição, seletor de categoria e valor.
  // No celular a data e o seletor descem para uma linha pequena embaixo.
  // Trocar a categoria aqui mesmo cria/atualiza a regra automática.
  function renderTxRow(tx: Transaction) {
    const usable = categoriesForDate(categories, tx.date).filter(c => c.type === tx.type || c.type === 'ambos')
    const date = format(new Date(tx.date + 'T00:00:00'), 'dd MMM', { locale: ptBR })
    const select = (
      <div className="flex items-center gap-1.5 shrink-0">
        {savingTxId === tx.id && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
        <Select
          value={tx.category}
          onValueChange={v => v && v !== tx.category && handleRecategorize(tx.id, v)}
          disabled={savingTxId === tx.id}
        >
          <SelectTrigger className="h-6 text-[11px] px-2 w-auto max-w-[150px] border-dashed rounded-full">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <CategoryOptions list={usable} all={categories} className="text-xs" />
          </SelectContent>
        </Select>
      </div>
    )
    return (
      <div key={tx.id} className="rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <span className="hidden sm:block w-12 shrink-0 text-[11px] text-slate-400 tabular-nums">{date}</span>
          <p className="flex-1 min-w-0 text-[13px] text-slate-600 dark:text-slate-300 truncate" title={tx.description}>
            {tx.description}
            {installmentLabel(tx) && <span className="text-[11px] text-slate-400"> · {installmentLabel(tx)}</span>}
          </p>
          <div className="hidden sm:block">{select}</div>
          <span className={`w-24 text-right text-[13px] font-medium tabular-nums shrink-0 ${tx.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
            {fmt(Number(tx.amount))}
          </span>
        </div>
        <div className="sm:hidden mt-1 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">{date}</span>
          {select}
        </div>
      </div>
    )
  }

  // Lista simples (Entradas por categoria).
  function renderTxList(txs: Transaction[]) {
    return <div className="mt-2 ml-1.5 pl-3 border-l-2 border-slate-100 dark:border-slate-700">{txs.map(renderTxRow)}</div>
  }

  // Categoria aberta: cada subcategoria é um grupo (nome, quantos e total)
  // com os lançamentos dela logo embaixo; os que estão direto na categoria
  // ficam em "Sem subcategoria", no fim. A linha lateral leva a cor da categoria.
  function renderGrouped(cat: string, color: string, txs: Transaction[], subs: CategoryTotal['subs']) {
    const groups = subs.map(sub => ({ name: sub.name, total: sub.total, items: txs.filter(t => t.category === sub.name) }))
    const direct = txs.filter(t => t.category === cat || !subs.some(sub => sub.name === t.category))
    if (direct.length > 0) {
      groups.push({ name: subs.length > 0 ? 'Sem subcategoria' : cat, total: direct.reduce((acc, t) => acc + Number(t.amount), 0), items: direct })
    }
    return (
      <div className="mt-3 mb-1 ml-4 sm:ml-[30px] pl-3 sm:pl-4 border-l-2" style={{ borderColor: `${color}66` }}>
        {groups.map(g => (
          <div key={g.name} className="pb-1.5">
            <div className="flex items-center gap-2 px-2 pt-2 pb-1">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <p className="flex-1 min-w-0 text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                {g.name}
                <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                  {g.items.length} {g.items.length === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              </p>
              <span className="w-24 text-right text-[13px] font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">{fmt(g.total)}</span>
            </div>
            <div className="sm:pl-4">{g.items.map(renderTxRow)}</div>
          </div>
        ))}
      </div>
    )
  }

  // Só para mostrar à parte — nada some sem explicação.
  const internal = useMemo(() => internalTotals(transactions), [transactions])

  const dailyFlowData = useMemo(
    () => aggregateDailyFlow(transactions, month, year),
    [transactions, month, year],
  )

  const cardCls = 'bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">

      {/* Erro ao sincronizar a regra automática — antes só ia pro console do
          navegador, invisível pro usuário; agora aparece aqui. */}
      {ruleSyncError && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Categoria salva, mas a regra automática falhou</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{ruleSyncError}</p>
          </div>
          <button onClick={() => setRuleSyncError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmação de sucesso — antes, criar/atualizar a regra com sucesso
          não mostrava nada na tela. */}
      {ruleSyncSuccess && (
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Regra criada/atualizada: &ldquo;{ruleSyncSuccess.category}&rdquo;</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              {ruleSyncSuccess.applied > 0
                ? `${ruleSyncSuccess.applied} transação${ruleSyncSuccess.applied !== 1 ? 'ões' : ''} com a mesma descrição também foi${ruleSyncSuccess.applied !== 1 ? 'ram' : ''} atualizada${ruleSyncSuccess.applied !== 1 ? 's' : ''}.`
                : 'Nenhuma outra transação com a mesma descrição encontrada.'}
            </p>
          </div>
          <button onClick={() => setRuleSyncSuccess(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Análise de Gastos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entradas, saídas e distribuição por categoria</p>
        </div>

        {/* Filters — mês e conta na mesma linha, também no celular */}
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          </div>

          <select
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
            className="flex-1 min-w-0 sm:flex-none h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Todas as contas</option>
            {boards.filter(b => !b.is_investment).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards — lado a lado também no celular; lá o ícone some
          para os três valores caberem */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 sm:h-24 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {([
            { label: 'Entradas', short: 'Entradas', value: totalIncome, prevValue: prev.totalIncome, upIsGood: true, icon: TrendingUp, iconCls: 'bg-green-50 dark:bg-green-900/30 text-green-500', valueCls: 'text-green-600' },
            { label: 'Saídas', short: 'Saídas', value: totalExpenses, prevValue: prev.totalExpenses, upIsGood: false, icon: TrendingDown, iconCls: 'bg-red-50 dark:bg-red-900/30 text-red-500', valueCls: 'text-red-500' },
            // Saldo: azul quando positivo, vermelho quando negativo (padrão do app).
            {
              label: 'Saldo do período', short: 'Saldo', value: balance, prevValue: prev.balance, upIsGood: true, icon: Wallet,
              iconCls: balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'bg-red-50 dark:bg-red-900/30 text-red-500',
              valueCls: balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500',
            },
          ] as const).map(card => (
            <div
              key={card.label}
              className={cn(cardCls, 'px-2 py-3 sm:p-4 flex flex-col lg:flex-row items-center gap-1 lg:gap-4 min-w-0')}
            >
              <div className={`hidden lg:flex h-11 w-11 rounded-full items-center justify-center shrink-0 ${card.iconCls}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 w-full lg:w-auto lg:flex-1 text-center lg:text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="sm:hidden">{card.short}</span>
                  <span className="hidden sm:inline">{card.label}</span>
                </p>
                <p className={`text-[13px] sm:text-lg xl:text-xl font-bold tabular-nums truncate ${card.valueCls}`}>{fmt(card.value)}</p>
              </div>
              {hasPrev && <ChangeBadge value={change(card.value, card.prevValue)} upIsGood={card.upIsGood} />}
            </div>
          ))}
        </div>
      )}

      {/* Recolhível: fechado, vira uma linha só com o resumo */}
      {!loading && internal.count > 0 && (
        <button
          type="button"
          onClick={toggleInternal}
          aria-expanded={internalOpen}
          className="w-full text-left flex items-start gap-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl p-3.5"
        >
          <ArrowLeftRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          {!internalOpen ? (
            <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
              <strong className="text-slate-600 dark:text-slate-300">Entre suas contas:</strong>{' '}
              {internal.count} lançamento{internal.count === 1 ? '' : 's'} fora dos totais
            </p>
          ) : (
          <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
            <strong className="text-slate-600 dark:text-slate-300">Entre suas contas:</strong>{' '}
            {internal.out > 0.005 && <>{fmt(internal.out)} saíram</>}
            {internal.out > 0.005 && internal.in > 0.005 && ' e '}
            {internal.in > 0.005 && <>{fmt(internal.in)} entraram</>}
            {' '}em {internal.count} lançamento{internal.count === 1 ? '' : 's'} marcados como movimentação
            entre contas suas (pagamento de fatura, transferência). Eles aparecem no extrato e no saldo
            das contas, mas ficam <strong>fora</strong> dos totais acima — não são gasto nem ganho.
          </p>
          )}
          {internalOpen
            ? <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            : <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
        </button>
      )}

      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={BarChart2}
          iconColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-500/15"
          title="Sem dados para este período"
          description="Adicione movimentações ou importe um extrato para visualizar a análise de gastos por categoria."
          primaryLabel="Adicionar movimentação"
          primaryHref="/transactions"
          secondaryLabel="Importar extrato"
          secondaryHref="/transactions"
        />
      )}

      {!loading && transactions.length > 0 && (
        <>
          <DailyFlowChart data={dailyFlowData} month={month} year={year} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
            {/* Despesas por categoria */}
            <section className={cn(cardCls, 'overflow-hidden')}>
              <div className="p-5 pb-2">
                <CardHeading
                  icon={BarChart2}
                  title="Despesas por Categoria"
                  subtitle="Quanto saiu de verdade neste período, agrupado por categoria."
                  extra={boardId !== 'all' && (
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      {boards.find(b => b.id === boardId)?.name}
                    </span>
                  )}
                />
                {expenseByCategory.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">Nenhuma despesa neste período.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {expenseByCategory.map(({ cat, total, count, pct, subs, txs }) => {
                      const open = expandedCat === `despesa:${cat}`
                      const color = colorOf(cat)
                      const mother = findMother(categories, cat, 'despesa')
                      const iconKey = mother ? categoryIconKey(mother, categories) : guessIconKey(cat)
                      const bar = (
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(total / maxExpense) * 100}%`, backgroundColor: color }}
                          />
                        </div>
                      )
                      return (
                        <div key={cat} id={`cat-${cat}`} className="py-3 scroll-mt-20">
                          <button
                            className="w-full text-left group"
                            onClick={() => setExpandedCat(open ? null : `despesa:${cat}`)}
                            aria-expanded={open}
                          >
                            <div className="flex items-center gap-3">
                              {/* Seta antes do ícone, no mesmo padrão dos outros blocos recolhíveis. */}
                              <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
                              <div
                                className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${color}1f`, color }}
                              >
                                <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1 sm:flex-none sm:w-48">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:underline">{cat}</p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {count} {count === 1 ? 'lançamento' : 'lançamentos'}
                                  {subs.length > 0 && ` · ${subs.length} subcategoria${subs.length === 1 ? '' : 's'}`}
                                </p>
                              </div>
                              <div className="hidden sm:block flex-1 min-w-0">{bar}</div>
                              <div className="shrink-0 text-right w-24">
                                <p className="text-sm font-semibold whitespace-nowrap text-red-500 tabular-nums">{fmt(total)}</p>
                                <p className="text-[11px] text-slate-400">{pct.toFixed(0)}%</p>
                              </div>
                            </div>
                            <div className="sm:hidden mt-2 ml-[76px]">{bar}</div>
                          </button>

                          {open && renderGrouped(cat, color, txs, subs)}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de despesas</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(totalExpenses)}</span>
              </div>
            </section>

            {/* Em telas médias os dois quadros ficam lado a lado, abaixo da lista. */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1 items-start">
              {/* Distribuição das despesas */}
              {donut.length > 0 && <DonutCard title="Distribuição das despesas" items={donut} total={totalExpenses} />}

              {/* Insight do mês */}
              <section className="rounded-xl border border-blue-100 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-900/20 p-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-white dark:bg-blue-900/40 flex items-center justify-center shrink-0 shadow-sm">
                    <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Insight do mês</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {!hasPrev ? (
                        <>Ainda não há lançamentos de {MONTH_NAMES[prevMonth - 1].toLowerCase()} para comparar.</>
                      ) : insight ? (
                        <>
                          Seus gastos com <strong>{insight.cat}</strong> aumentaram {insight.pct.toFixed(0)}% ({fmt(insight.diff)} a mais)
                          em relação a {MONTH_NAMES[prevMonth - 1].toLowerCase()}. Que tal revisar os últimos lançamentos dessa categoria?
                        </>
                      ) : (
                        <>Nenhuma categoria gastou mais que em {MONTH_NAMES[prevMonth - 1].toLowerCase()}. Continue assim!</>
                      )}
                    </p>
                    {hasPrev && monthInProgress && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                        O mês ainda está em andamento — a comparação é com o mês anterior inteiro.
                      </p>
                    )}
                    {insight && (
                      <button
                        type="button"
                        onClick={() => openCategory(insight.cat)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-transparent px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* Distribuição das receitas */}
              {incomeDonut.length > 0 && <DonutCard title="Distribuição das receitas" items={incomeDonut} total={totalIncome} />}
            </div>
          </div>

          {/* Entradas por categoria — recolhida por padrão */}
          {incomeByCategory.length > 0 && (
            <section className={cn(cardCls, 'overflow-hidden')}>
              <button
                type="button"
                onClick={() => setIncomeOpen(v => !v)}
                aria-expanded={incomeOpen}
                className="w-full text-left flex items-center gap-2 p-5"
              >
                <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', incomeOpen && 'rotate-90')} />
                <BarChart2 className="h-4 w-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Entradas por Categoria</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quanto entrou de verdade neste período, agrupado por categoria.</p>
                </div>
                <span className="text-sm font-semibold text-green-600 tabular-nums shrink-0">{fmt(totalIncome)}</span>
              </button>

              {incomeOpen && (
                <div className="px-5 pb-5 space-y-3">
                  {incomeByCategory.map(({ cat, total, count, pct, txs }) => {
                    const maxIncome = incomeByCategory[0]?.total ?? 1
                    const open = expandedCat === `receita:${cat}`
                    return (
                      <div key={cat}>
                        <button
                          className="w-full text-left group"
                          onClick={() => setExpandedCat(open ? null : `receita:${cat}`)}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:underline">{cat}</p>
                              <p className="text-[11px] text-slate-400">{count} {count === 1 ? 'lançamento' : 'lançamentos'}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold whitespace-nowrap text-green-600">{fmt(total)}</p>
                              <p className="text-[11px] text-slate-400">{pct.toFixed(0)}%</p>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500 transition-all duration-500"
                              style={{ width: `${(total / maxIncome) * 100}%` }}
                            />
                          </div>
                        </button>
                        {open && renderTxList(txs)}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

    </div>
  )
}
