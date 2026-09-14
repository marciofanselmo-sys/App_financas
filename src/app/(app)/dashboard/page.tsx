'use client'

import { useState, useMemo } from 'react'
import { buildDisplayItems } from '@/lib/recurring-groups'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useRecurring } from '@/hooks/use-recurring'
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
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { useBudgetPlansRange } from '@/hooks/use-budget-plans-range'
import { useGoals } from '@/hooks/use-goals'
import { sumInvestmentContributions, aggregateContributionsByMonth } from '@/lib/investment-contributions'
import { InvestTargetChart } from '@/components/dashboard/invest-target-chart'
import { LayoutGrid, AlertCircle, CreditCard, RefreshCw, Upload, CheckCircle, Tag } from 'lucide-react'
import Link from 'next/link'
import { OnboardingModal } from '@/components/onboarding-modal'
import { NextActionCard } from '@/components/dashboard/next-action-card'
import { AppPageHeader } from '@/components/layout/app-page-header'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function DashboardPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { boards, loading: boardsLoading } = useTransactionBoards()
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
  // Mesma exclusão do fluxo do mês. Antes o patrimônio tirava só as contas de
  // investimento, então uma conta desafixada do dashboard ficava de fora do mês
  // mas DENTRO do patrimônio — o usuário escondia a conta da loja e via o
  // dinheiro dela somando no patrimônio pessoal mesmo assim. (14.14)
  const { transactions: allCashTransactions, loading: patrimonyLoading } = useTransactions({
    exclude_board_ids: unpinnedBoardIds.length > 0 ? unpinnedBoardIds : undefined,
  })
  const { transactions: allTransactions, loading: allTxLoading } = useTransactions()
  const patrimony = useMemo(
    () => computePatrimonyOverview(
      boards.filter(b => b.show_on_dashboard || b.is_investment),
      allCashTransactions,
    ),
    [boards, allCashTransactions],
  )
  const { plan, loading: planLoading, savePlan } = useBudgetPlan(month, year)
  const { defaultInvestmentPct, updatePreferences, loading: prefsLoading } = useUserPreferences()
  const [savingInvestTarget, setSavingInvestTarget] = useState(false)
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
  const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`
  const investTargetChartData = useMemo(
    () => contributionsByMonth.map(p => ({
      label: p.label,
      meta: p.key === currentMonthKey
        ? (plan?.investment_target ?? targetsByKey[p.key] ?? 0)
        : (targetsByKey[p.key] ?? 0),
      aportes: p.aportes,
    })),
    [contributionsByMonth, targetsByKey, currentMonthKey, plan?.investment_target],
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
  // buildDisplayItems é a mesma função que /fixos usa. A cópia que existia
  // aqui divergia em dois pontos, os dois silenciosos:
  //   - somava o monthsCount dos membros em vez de unir os meses: Netflix e
  //     Spotify com 3 meses cada viravam um grupo "Streaming" de 6 meses, e a
  //     média mensal saía pela metade (14.7);
  //   - montava a chave sem decisionKey(), então o que o usuário confirmava em
  //     /fixos não era reconhecido aqui.
  const groupedRecurring = useMemo(
    () => buildDisplayItems(despesaRecurring, new Map()),
    [despesaRecurring],
  )
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

  async function handleSaveInvestmentTarget(target: number, pct: number) {
    setSavingInvestTarget(true)
    const [{ error }, { error: prefError }] = await Promise.all([
      savePlan({
        month,
        year,
        expected_income: plan?.expected_income ?? summary.totalIncome,
        expenses_target: plan?.expenses_target ?? 0,
        investment_target: target,
        reserve_target: plan?.reserve_target ?? 0,
        category_limits: plan?.category_limits ?? {},
      }),
      updatePreferences({ investment_pct: pct }),
    ])
    setSavingInvestTarget(false)
    return { error: error ?? prefError }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <OnboardingModal />
      <AppPageHeader
        title="Dashboard"
        subtitle="Patrimônio acumulado + fluxo do mês"
        actions={
          <>
            <Link
              href="/import"
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-white dark:bg-white/[0.04] text-[#2563EB] dark:text-blue-300 hover:bg-[#E8F2FF] dark:hover:bg-blue-500/15 transition-colors border border-[#DDE7F3] dark:border-white/[0.08] shadow-[var(--nobli-shadow-s)]"
            >
              <Upload className="h-4 w-4" />
              Importar Extrato
            </Link>
            <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          </>
        }
      />

      <MacroOverview overview={patrimony} loading={boardsLoading || patrimonyLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PatrimonyCompositionChart data={patrimonyChartData} loading={chartsLoading} />
        <CashBalanceTrendChart data={cashBalanceTrend} loading={chartsLoading} />
      </div>

      <MonthlyFlowChart data={monthlyFlowData} loading={chartsLoading} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93A5C1] dark:text-slate-500 mb-3">
          Fluxo do mês
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 nobli-card animate-pulse" />
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
          defaultInvestmentPct={defaultInvestmentPct}
          actualContributions={monthlyContributions}
          loading={planLoading || loading || allTxLoading || prefsLoading}
          saving={savingInvestTarget}
          onSaveTarget={handleSaveInvestmentTarget}
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
          <div className="h-56 nobli-card animate-pulse" />
        ) : (
          <TopCategoriesBar transactions={transactions} />
        )}

        {/* Parcelas Ativas */}
        <div className="nobli-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="nobli-chip h-8 w-8 rounded-lg">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="nobli-card-title">Parcelas Ativas</span>
            </div>
            <Link href="/recurring" className="text-xs font-semibold text-[#2563EB] hover:underline">
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
        <div className="nobli-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="nobli-chip h-8 w-8 rounded-lg">
                <RefreshCw className="h-4 w-4" />
              </div>
              <span className="nobli-card-title">Gastos Fixos</span>
            </div>
            <Link href="/fixos" className="text-xs font-semibold text-[#2563EB] hover:underline">
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
              <LayoutGrid className="h-4 w-4 text-[#93A5C1]" />
              <h2 className="nobli-card-title">Minhas Contas</h2>
              <span className="text-xs text-[#93A5C1] dark:text-slate-500">— este mês</span>
            </div>
            <Link href="/transactions" className="text-xs font-semibold text-[#2563EB] hover:underline">
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
                // Todas as transações da conta, não as do mês: o card mostra
                // SALDO, e saldo é a soma de tudo que passou pela conta. Com o
                // recorte do mês, a mesma conta aparecia com um número aqui e
                // outro no bloco Patrimônio, logo abaixo na mesma tela.
                <BoardSummaryCard
                  key={board.id}
                  board={board}
                  transactions={allTransactions.filter(t => t.board_id === board.id)}
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
