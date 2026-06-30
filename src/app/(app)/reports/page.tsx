'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useRecurring } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useCategories } from '@/hooks/use-categories'
import { calcHealthScore, scoreConfig } from '@/components/dashboard/summary-cards'
import {
  Printer, CalendarDays, BarChart2, CreditCard, RefreshCw, CheckCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { PeriodFilter } from '@/components/dashboard/period-filter'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(v)

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

type ReportType = 'mensal' | 'anual' | 'parcelas' | 'fixos'
const REPORT_TYPES: { id: ReportType; label: string; icon: React.ElementType }[] = [
  { id: 'mensal',   label: 'Mensal',      icon: CalendarDays },
  { id: 'anual',    label: 'Anual',       icon: BarChart2    },
  { id: 'parcelas', label: 'Parcelas',    icon: CreditCard   },
  { id: 'fixos',    label: 'Gastos Fixos',icon: RefreshCw    },
]

const now = new Date()

// ── Tokens de estilo reutilizados ─────────────────────────────────────────────
const card  = 'bg-white dark:bg-[#111c2d] print:bg-white border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl p-4'
const table = 'border border-slate-100 dark:border-white/[0.06] print:border-slate-200 rounded-xl overflow-hidden'
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
          <p className="font-semibold text-slate-600 dark:text-slate-300 print:text-slate-600">FinanceApp</p>
          <p>Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}

// ── Relatório Mensal ──────────────────────────────────────────────────────────
function MonthlyReport({ month, year, boardId, excludeBoardIds }: { month: number; year: number; boardId: string; excludeBoardIds: string[] }) {
  const { transactions, loading } = useTransactions({
    month,
    year,
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  })
  const { plan } = useBudgetPlan(month, year)
  const { categories } = useCategories()

  const income   = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  const balance  = income - expenses
  const score    = calcHealthScore(income, expenses)
  const { label: scoreLabel } = scoreConfig(score ?? 0)

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'despesa').forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + Number(t.amount)
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name, amount,
        pct: expenses > 0 ? amount / expenses : 0,
        color: categories.find(c => c.name === name)?.color ?? '#6b7280',
      }))
  }, [transactions, expenses, categories])

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

      {/* Gastos por categoria */}
      {byCategory.length > 0 && (
        <div>
          <h3 className={secTitle}>Gastos por Categoria</h3>
          <div className={table}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Categoria</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Valor</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>% Total</th>
                  {hasPlanned && <th className={`text-right px-4 py-2.5 ${th}`}>Planejado</th>}
                </tr>
              </thead>
              <tbody className={tdiv}>
                {byCategory.map(cat => (
                  <tr key={cat.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 print:text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(cat.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">{fmtPct(cat.pct)}</td>
                    {hasPlanned && (
                      <td className="px-4 py-2.5 text-right text-slate-400 dark:text-slate-500 print:text-slate-400">
                        {categoryLimits[cat.name] ? fmt(Number(categoryLimits[cat.name])) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className={tfoot}>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(expenses)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">100%</td>
                  {hasPlanned && <td />}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
function AnnualReport({ year, boardId, excludeBoardIds }: { year: number; boardId: string; excludeBoardIds: string[] }) {
  const { transactions, loading } = useTransactions({
    year,
    board_id: boardId !== 'all' ? boardId : undefined,
    exclude_board_ids: boardId === 'all' ? excludeBoardIds : undefined,
  })

  const monthly = useMemo(() => {
    const map = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expenses: 0, balance: 0 }))
    transactions.forEach(t => {
      const m = new Date(t.date + 'T12:00:00').getMonth()
      if (t.type === 'receita') map[m].income += Number(t.amount)
      else if (t.type === 'despesa') map[m].expenses += Number(t.amount)
    })
    map.forEach(m => { m.balance = m.income - m.expenses })
    return map
  }, [transactions])

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.filter(t => t.type === 'despesa').forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + Number(t.amount)
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [transactions])

  const totalIncome   = monthly.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0)
  const totalBalance  = totalIncome - totalExpenses
  const activeMonths  = monthly.filter(m => m.income > 0 || m.expenses > 0)
  const bestMonth     = activeMonths.length ? [...activeMonths].sort((a, b) => b.balance - a.balance)[0] : null
  const worstMonth    = activeMonths.length ? [...activeMonths].sort((a, b) => a.balance - b.balance)[0] : null

  if (loading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader title={`Relatório Anual — ${year}`} subtitle={`${transactions.length} transações no ano`} />

      <div className="grid grid-cols-3 gap-3">
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
        <h3 className={secTitle}>Evolução Mensal</h3>
        <div className={table}>
          <table className="w-full text-sm">
            <thead className={thead}>
              <tr>
                <th className={`text-left px-4 py-2.5 ${th}`}>Mês</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Receitas</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Despesas</th>
                <th className={`text-right px-4 py-2.5 ${th}`}>Saldo</th>
              </tr>
            </thead>
            <tbody className={tdiv}>
              {monthly.map(m => (
                <tr key={m.month} className={`hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors ${m.income === 0 && m.expenses === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 print:text-slate-700">{MONTH_NAMES[m.month - 1]}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600 font-semibold">{m.income > 0 ? fmt(m.income) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-500 font-semibold">{m.expenses > 0 ? fmt(m.expenses) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${m.balance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>
                    {m.income > 0 || m.expenses > 0 ? fmt(m.balance) : '—'}
                  </td>
                </tr>
              ))}
              <tr className={tfoot}>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 print:text-slate-700">Total {year}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 dark:text-emerald-400 print:text-emerald-600">{fmt(totalIncome)}</td>
                <td className="px-4 py-2.5 text-right text-red-500">{fmt(totalExpenses)}</td>
                <td className={`px-4 py-2.5 text-right ${totalBalance >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>{fmt(totalBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div>
          <h3 className={secTitle}>Despesas por Categoria no Ano</h3>
          <div className={table}>
            <table className="w-full text-sm">
              <thead className={thead}>
                <tr>
                  <th className={`text-left px-4 py-2.5 ${th}`}>Categoria</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Total</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>Média/mês</th>
                  <th className={`text-right px-4 py-2.5 ${th}`}>% Total</th>
                </tr>
              </thead>
              <tbody className={tdiv}>
                {byCategory.map(([name, amount]) => (
                  <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 print:text-slate-700">{name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(amount)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">{fmt(amount / 12)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400 print:text-slate-500">
                      {totalExpenses > 0 ? fmtPct(amount / totalExpenses) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          primaryHref="/import"
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
function buildGroupedItems(recurring: import('@/hooks/use-recurring').RecurringItem[]) {
  const grouped = new Map<string, typeof recurring>()
  const singles: typeof recurring = []
  for (const r of recurring) {
    const label = r.group_label?.trim() || null
    if (label) { grouped.set(label, [...(grouped.get(label) ?? []), r]) }
    else { singles.push(r) }
  }
  const items: { key: string; name: string; avgAmount: number; monthsCount: number; lastDate: string; category: string; isGroup: boolean; descriptions: string[] }[] = []
  for (const [label, members] of grouped.entries()) {
    const totalCount = members.reduce((s, r) => s + r.monthsCount, 0)
    const avgAmount = totalCount > 0 ? members.reduce((s, r) => s + r.avgAmount * r.monthsCount, 0) / totalCount : 0
    const lastDate = members.reduce((max, r) => r.lastDate > max ? r.lastDate : max, '')
    items.push({ key: `group:${label}`, name: label, avgAmount, monthsCount: totalCount, lastDate, category: members[0]?.category ?? '', isGroup: true, descriptions: members.map(r => r.description) })
  }
  for (const r of singles) {
    items.push({ key: r.description.toLowerCase(), name: r.description, avgAmount: r.avgAmount, monthsCount: r.monthsCount, lastDate: r.lastDate, category: r.category, isGroup: false, descriptions: [r.description] })
  }
  return items.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount)
}

function FixedChargesReport({ boardId, excludeBoardIds }: { boardId: string; excludeBoardIds: string[] }) {
  const { recurring, loading } = useRecurring(
    boardId === 'all' ? excludeBoardIds : undefined,
    boardId !== 'all' ? boardId : undefined,
  )
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()

  const allItems   = useMemo(() => buildGroupedItems(recurring), [recurring])
  const confirmed  = allItems.filter(i => decisions.get(i.key) === 'confirmed')
  const pending    = allItems.filter(i => !decisions.has(i.key))
  const totalMonthly = confirmed.reduce((s, i) => s + i.avgAmount, 0)
  const fmtDate      = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }

  if (loading || decisionsLoading) return <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">Carregando...</div>

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Relatório de Gastos Fixos"
        subtitle={`${confirmed.length} confirmados · ${pending.length} aguardando revisão`}
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
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-slate-500 text-xs">{item.category}</td>
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

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-500 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide mb-3">
            Aguardando Revisão ({pending.length})
          </h3>
          <div className="border border-amber-200 dark:border-amber-800/40 print:border-amber-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-900/20 print:bg-amber-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide">Descrição</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide">Categoria</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide">Meses</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 print:text-amber-600 uppercase tracking-wide">Média/mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30 print:divide-amber-100">
                {pending.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 print:text-slate-700">
                      <div>{item.name}</div>
                      {item.isGroup && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{item.descriptions.join(', ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 print:text-slate-500 text-xs">{item.category}</td>
                    <td className="px-4 py-2.5 text-center text-slate-500 dark:text-slate-400 print:text-slate-500">{item.monthsCount}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(item.avgAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmed.length === 0 && pending.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          iconColor="text-sky-500"
          iconBg="bg-sky-50 dark:bg-sky-500/15"
          title="Nenhuma cobrança fixa detectada"
          description="O app detecta automaticamente despesas que aparecem em 2+ meses. Importe seus extratos para começar."
          primaryLabel="Importar extrato"
          primaryHref="/import"
        />
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [type, setType] = useState<ReportType>('mensal')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [boardId, setBoardId] = useState<string>('all')

  const { boards } = useTransactionBoards()
  const excludeBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard).map(b => b.id),
    [boards]
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Relatórios</h1>
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
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
          {REPORT_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setType(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
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
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white dark:bg-[#111c2d] print:bg-white rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] print:border-0 print:shadow-none p-6 print:p-0">
        {type === 'mensal'   && <MonthlyReport month={month} year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'anual'    && <AnnualReport year={year} boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'parcelas' && <InstallmentsReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
        {type === 'fixos'    && <FixedChargesReport boardId={boardId} excludeBoardIds={excludeBoardIds} />}
      </div>
    </div>
  )
}
