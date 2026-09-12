'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useRecurring, RecurringItem } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { DiagnosticCard } from '@/components/dashboard/diagnostic-card'
import { TopCategoriesBar } from '@/components/dashboard/top-categories-bar'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { BoardSummaryCard } from '@/components/dashboard/board-summary-card'
import { MacroOverview } from '@/components/dashboard/macro-overview'
import { InvestMonthCard } from '@/components/dashboard/invest-month-card'
import { GoalsSummaryCard } from '@/components/dashboard/goals-summary-card'
import { DashboardSummary } from '@/types'
import { computePatrimonyOverview } from '@/lib/dashboard-patrimony'
import {
  getMonthRange,
  aggregateMonthlyFlow,
  aggregateCashBalanceTrend,
  buildPatrimonyChartData,
  buildExpenseChartData,
  buildIncomeCommitment,
  buildPlannedVsActual,
} from '@/lib/dashboard-charts'
import { PatrimonyCompositionChart } from '@/components/dashboard/charts/patrimony-composition-chart'
import { MonthlyFlowChart } from '@/components/dashboard/charts/monthly-flow-chart'
import { CashBalanceTrendChart } from '@/components/dashboard/charts/cash-balance-trend-chart'
import { ExpenseDistributionChart } from '@/components/dashboard/charts/expense-distribution-chart'
import { IncomeCommitmentChart } from '@/components/dashboard/charts/income-commitment-chart'
import { PlannedVsActualChart } from '@/components/dashboard/charts/planned-vs-actual-chart'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useBudgetPlansRange } from '@/hooks/use-budget-plans-range'
import { useGoals } from '@/hooks/use-goals'
import { sumInvestmentContributions, aggregateContributionsByMonth } from '@/lib/investment-contributions'
import { InvestTargetChart } from '@/components/dashboard/invest-target-chart'
import { LayoutGrid, AlertCircle, CreditCard, RefreshCw, Upload, CheckCircle, Tag } from 'lucide-react'
import Link from 'next/link'
import { OnboardingModal } from '@/components/onboarding-modal'
import { NextActionCard } from '@/components/dashboard/next-action-card'

// Agrupa por group_label (subcategoria), calcula média ponderada — mesma lógica do fixos/page
interface GroupedRecurring {
  key: string
  name: string
  avgAmount: number
  monthsCount: number
  isGroup: boolean
}

function buildGroupedRecurring(recurring: RecurringItem[]): GroupedRecurring[] {
  const grouped = new Map<string, RecurringItem[]>()
  const singles: RecurringItem[] = []

  for (const r of recurring) {
    const label = r.group_label?.trim() || null
    if (label) {
      grouped.set(label, [...(grouped.get(label) ?? []), r])
    } else {
      singles.push(r)
    }
  }

  const items: GroupedRecurring[] = []

  for (const [label, members] of grouped.entries()) {
    const totalCount = members.reduce((s, r) => s + r.monthsCount, 0)
    const avgAmount = totalCount > 0
      ? members.reduce((s, r) => s + r.avgAmount * r.monthsCount, 0) / totalCount
      : 0
    items.push({ key: `group:${label}`, name: label, avgAmount, monthsCount: totalCount, isGroup: true })
  }

  for (const r of singles) {
    items.push({
      key: r.description.toLowerCase(),
      name: r.description,
      avgAmount: r.avgAmount,
      monthsCount: r.monthsCount,
      isGroup: false,
    })
  }

  return items.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount)
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function DashboardPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { boards, loading: boardsLoading } = useTransactionBoards()
  const investmentBoardIds = useMemo(
    () => boards.filter(b => b.is_investment).map(b => b.id),
    [boards],
  )
  // Investimento nunca entra no fluxo mensal — patrimônio de carteira vem da posição importada.
  const unpinnedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards],
  )
  const { installments, recurring, loading: recurringLoading } = useRecurring(unpinnedBoardIds)
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()
  const { transactions, loading } = useTransactions({
    month,
    year,
    exclude_board_ids: unpinnedBoardIds,
  })
  const { transactions: allCashTransactions, loading: patrimonyLoading } = useTransactions({
    exclude_board_ids: investmentBoardIds.length > 0 ? investmentBoardIds : undefined,
  })
  const { transactions: allTransactions, loading: allTxLoading } = useTransactions()
  const patrimony = useMemo(
    () => computePatrimonyOverview(boards, allCashTransactions),
    [boards, allCashTransactions],
  )
  const { plan, loading: planLoading } = useBudgetPlan(month, year)
  const { targetsByKey, loading: targetsRangeLoading } = useBudgetPlansRange(month, year, 6)
  const { goals, loading: goalsLoading } = useGoals()

  const chartMonths = useMemo(() => getMonthRange(month, year, 6), [month, year])

  const monthlyContributions = useMemo(
    () => sumInvestmentContributions(transactions, boards),
    [transactions, boards],
  )
  const contributionsByMonth = useMemo(
    () => aggregateContributionsByMonth(allTransactions, boards, chartMonths),
    [allTransactions, boards, chartMonths],
  )
  const investTargetChartData = useMemo(
    () => contributionsByMonth.map(p => ({
      label: p.label,
      meta: targetsByKey[p.key] ?? 0,
      aportes: p.aportes,
    })),
    [contributionsByMonth, targetsByKey],
  )
  const monthlyFlowData = useMemo(
    () => aggregateMonthlyFlow(allCashTransactions, chartMonths),
    [allCashTransactions, chartMonths],
  )
  const cashBalanceTrend = useMemo(
    () => aggregateCashBalanceTrend(allCashTransactions, chartMonths),
    [allCashTransactions, chartMonths],
  )
  const patrimonyChartData = useMemo(
    () => buildPatrimonyChartData(patrimony),
    [patrimony],
  )
  const expenseChartData = useMemo(
    () => buildExpenseChartData(transactions),
    [transactions],
  )
  const plannedVsActual = useMemo(
    () => buildPlannedVsActual(plan, transactions),
    [plan, transactions],
  )

  const pinnedBoards = boards.filter(b => b.show_on_dashboard && !b.is_investment)

  const summary: DashboardSummary = transactions.reduce(
    (acc, t) => {
      if (t.type === 'transferencia') return acc
      if (t.type === 'receita') acc.totalIncome += Number(t.amount)
      else acc.totalExpenses += Number(t.amount)
      acc.balance = acc.totalIncome - acc.totalExpenses
      return acc
    },
    { totalIncome: 0, totalExpenses: 0, balance: 0 }
  )

  const activeInstallments = installments.filter(i => i.remaining > 0)
  const totalMonthlyInstallments = activeInstallments.reduce((s, i) => s + i.monthlyAmount, 0)

  // Apenas os fixos que o usuário confirmou na aba Recorrências, com agrupamento por subcategoria.
  // "Gasto fixo" aqui é só despesa — recorrência também detecta receita e
  // transferência (usadas em /fixos), mas esse card do dashboard é sobre gasto.
  const despesaRecurring = useMemo(() => recurring.filter(r => r.type === 'despesa'), [recurring])
  const groupedRecurring = useMemo(() => buildGroupedRecurring(despesaRecurring), [despesaRecurring])
  const confirmedRecurring = useMemo(
    () => groupedRecurring.filter(i => decisions.get(i.key) === 'confirmed'),
    [groupedRecurring, decisions],
  )
  const totalMonthlyRecurring = confirmedRecurring.reduce((s, r) => s + r.avgAmount, 0)
  const pendingRecurringCount = groupedRecurring.filter(i => !decisions.has(i.key)).length

  const incomeCommitment = useMemo(
    () => buildIncomeCommitment(
      summary.totalIncome,
      totalMonthlyRecurring,
      totalMonthlyInstallments,
      summary.totalExpenses,
    ),
    [summary.totalIncome, summary.totalExpenses, totalMonthlyRecurring, totalMonthlyInstallments],
  )

  const chartsLoading = boardsLoading || patrimonyLoading || loading

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <OnboardingModal />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Patrimônio acumulado + fluxo do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors border border-emerald-200 dark:border-emerald-500/20"
          >
            <Upload className="h-4 w-4" />
            Importar Extrato
          </Link>
          <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        </div>
      </div>

      <MacroOverview overview={patrimony} loading={boardsLoading || patrimonyLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PatrimonyCompositionChart data={patrimonyChartData} loading={chartsLoading} />
        <CashBalanceTrendChart data={cashBalanceTrend} loading={chartsLoading} />
      </div>

      <MonthlyFlowChart data={monthlyFlowData} loading={chartsLoading} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
          Fluxo do mês
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />
            ))}
          </div>
        ) : (
          <SummaryCards summary={summary} />
        )}
      </div>

      <InvestTargetChart
        data={investTargetChartData}
        loading={targetsRangeLoading || allTxLoading || boardsLoading}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InvestMonthCard
          monthlyIncome={summary.totalIncome}
          investmentTarget={plan?.investment_target ?? 0}
          actualContributions={monthlyContributions}
          loading={planLoading || loading || allTxLoading}
        />
        <GoalsSummaryCard goals={goals} loading={goalsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ExpenseDistributionChart data={expenseChartData} loading={loading} />
        <IncomeCommitmentChart
          segments={incomeCommitment.segments}
          hasIncome={incomeCommitment.hasIncome}
          monthlyIncome={summary.totalIncome}
          loading={loading || recurringLoading || decisionsLoading}
        />
        <PlannedVsActualChart data={plannedVsActual} loading={planLoading || loading} />
      </div>

      {/* Primeiros passos */}
      {!loading && !boardsLoading && !recurringLoading && !decisionsLoading && (
        <NextActionCard
          hasTransactions={transactions.length > 0}
          hasBoards={boards.length > 0}
          pendingRecurring={pendingRecurringCount}
          activeInstallments={activeInstallments.length}
        />
      )}

      {/* Diagnóstico Inteligente */}
      {!loading && (
        <DiagnosticCard transactions={transactions} month={month} year={year} />
      )}

      {/* Top 5 Gastos · Parcelas · Gastos Fixos — 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top 5 gastos por categoria */}
        {loading ? (
          <div className="h-56 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />
        ) : (
          <TopCategoriesBar transactions={transactions} />
        )}

        {/* Parcelas Ativas */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5 text-violet-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Parcelas Ativas</span>
            </div>
            <Link href="/recurring" className="text-xs text-blue-600 hover:underline">
              Ver todas →
            </Link>
          </div>

          {recurringLoading ? (
            <div className="h-16 bg-slate-50 dark:bg-slate-700 rounded-xl animate-pulse" />
          ) : activeInstallments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma parcela ativa detectada.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{activeInstallments.length}</span> ativas
                {' · '}
                <span className="font-semibold text-violet-600 dark:text-violet-400">{fmt(totalMonthlyInstallments)}/mês</span>
              </p>
              <div className="space-y-1">
                {activeInstallments.slice(0, 6).map(item => (
                  <div key={item.description} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.description}</span>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fmt(item.monthlyAmount)}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">{item.remaining}x</span>
                    </div>
                  </div>
                ))}
              </div>
              {activeInstallments.length > 6 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-2">
                  + {activeInstallments.length - 6} mais · <Link href="/recurring" className="text-blue-500 hover:underline">ver todas</Link>
                </p>
              )}
            </>
          )}
        </div>

        {/* Gastos Fixos */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center">
                <RefreshCw className="h-3.5 w-3.5 text-sky-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Gastos Fixos</span>
            </div>
            <Link href="/fixos" className="text-xs text-blue-600 hover:underline">
              Ver todos →
            </Link>
          </div>

          {recurringLoading || decisionsLoading ? (
            <div className="h-16 bg-slate-50 dark:bg-slate-700 rounded-xl animate-pulse" />
          ) : confirmedRecurring.length === 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum gasto fixo confirmado ainda.</p>
              <Link href="/fixos" className="text-xs text-sky-600 hover:underline">
                Confirmar em Recorrências →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{confirmedRecurring.length}</span> confirmado{confirmedRecurring.length !== 1 ? 's' : ''}
                {' · '}
                <span className="font-semibold text-sky-600 dark:text-sky-400">{fmt(totalMonthlyRecurring)}/mês</span>
              </p>
              <div className="space-y-1">
                {confirmedRecurring.slice(0, 8).map(item => (
                  <div key={item.key} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.isGroup && <Tag className="h-3 w-3 text-violet-400 shrink-0" />}
                      <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{fmt(item.avgAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {confirmedRecurring.length > 8 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-2">
                  + {confirmedRecurring.length - 8} mais · <Link href="/fixos" className="text-blue-500 hover:underline">ver todos</Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Minhas Contas */}
      {!boardsLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Minhas Contas</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">— este mês</span>
            </div>
            <Link href="/transactions" className="text-xs text-blue-600 hover:underline">
              Gerenciar contas
            </Link>
          </div>

          {pinnedBoards.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Nenhuma conta fixada. Em{' '}
                <Link href="/transactions" className="text-blue-600 hover:underline">Contas e Cartões</Link>
                , clique no 📌 de uma conta para exibi-la aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedBoards.map(board => (
                <BoardSummaryCard
                  key={board.id}
                  board={board}
                  transactions={transactions.filter(t => t.board_id === board.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerta: transações sem quadro */}
      {!loading && (() => {
        const unclassified = transactions.filter(t => !t.board_id)
        if (unclassified.length === 0) return null
        const inc = unclassified.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
        const exp = unclassified.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {unclassified.length} lançamento{unclassified.length !== 1 ? 's' : ''} sem conta este mês
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  Incluídos nos totais acima mas sem conta atribuída.
                  {inc > 0 && <> Entradas: <strong>{fmt(inc)}</strong>.</>}
                  {exp > 0 && <> Saídas: <strong>{fmt(exp)}</strong>.</>}
                </p>
              </div>
              <Link href="/transactions" className="text-xs text-amber-700 dark:text-amber-300 hover:underline shrink-0 font-medium">
                Ver contas →
              </Link>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
