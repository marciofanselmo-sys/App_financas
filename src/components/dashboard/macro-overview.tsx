'use client'

import Link from 'next/link'
import { Wallet, TrendingUp, Info, AlertCircle, ChevronRight } from 'lucide-react'
import { PatrimonyOverview, formatDashboardCurrency } from '@/lib/dashboard-patrimony'

interface MacroOverviewProps {
  overview: PatrimonyOverview
  loading?: boolean
}

export function MacroOverview({ overview, loading }: MacroOverviewProps) {
  if (loading) {
    return (
      <div className="h-44 bg-white dark:bg-[#111c2d] rounded-2xl animate-pulse border border-slate-100 dark:border-white/[0.06]" />
    )
  }

  const hasAnyData =
    overview.cashBreakdown.length > 0 ||
    overview.investments.length > 0 ||
    overview.unassignedCash !== 0

  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              Patrimônio · visão geral
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100 tabular-nums tracking-tight">
              {formatDashboardCurrency(overview.totalPatrimony)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md">
              Soma do saldo acumulado nas contas + carteira de investimentos (última posição importada).
            </p>
          </div>
          {!hasAnyData && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl p-3 max-w-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Crie contas e registre movimentações, ou importe a posição em Investimentos, para ver o patrimônio.
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Saldo em contas</span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatDashboardCurrency(overview.cashTotal)}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Histórico completo · entradas − saídas por conta
            </p>
            {overview.cashBreakdown.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-slate-200/80 dark:border-white/[0.06] pt-3">
                {overview.cashBreakdown.slice(0, 4).map(b => (
                  <li key={b.boardId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className={`font-semibold tabular-nums shrink-0 ${b.balance >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-red-500'}`}>
                      {formatDashboardCurrency(b.balance)}
                    </span>
                  </li>
                ))}
                {overview.cashBreakdown.length > 4 && (
                  <li className="text-[10px] text-slate-400 pt-0.5">
                    + {overview.cashBreakdown.length - 4} contas ·{' '}
                    <Link href="/transactions" className="text-blue-500 hover:underline">ver todas</Link>
                  </li>
                )}
              </ul>
            )}
            {overview.unassignedCash !== 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                Sem conta: {formatDashboardCurrency(overview.unassignedCash)}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Investimentos</span>
            </div>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatDashboardCurrency(overview.investmentsTotal)}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Última posição importada (XLSX)
            </p>
            {overview.investments.length > 0 ? (
              <ul className="mt-3 space-y-1 border-t border-slate-200/80 dark:border-white/[0.06] pt-3">
                {overview.investments.map(inv => (
                  <li key={inv.boardId} className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      href={`/transactions/${inv.boardId}`}
                      className="text-slate-600 dark:text-slate-300 hover:underline truncate"
                    >
                      {inv.name}
                    </Link>
                    <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                      {formatDashboardCurrency(inv.patrimonio)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                Nenhuma posição importada ainda.
              </p>
            )}
            {overview.missingInvestmentImport.length > 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                {overview.missingInvestmentImport.length} conta(s) sem importação ·{' '}
                <Link href="/investments" className="underline">Importar posição</Link>
              </p>
            )}
          </div>
        </div>

        <details className="mt-4 group">
          <summary className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 cursor-pointer list-none hover:text-slate-600 dark:hover:text-slate-300">
            <Info className="h-3.5 w-3.5" />
            Como calculamos
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pl-5 list-disc max-w-2xl">
            <li>Contas: soma de receitas menos despesas de cada conta (transferências entre contas não alteram o total).</li>
            <li>Investimentos: patrimônio informado no arquivo de posição — não somamos transações da conta de investimento aqui.</li>
            <li>Fluxo do mês (receitas/despesas abaixo) é independente e filtrado pelo período selecionado.</li>
          </ul>
        </details>
      </div>
    </section>
  )
}
