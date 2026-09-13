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
      <div className="h-44 nobli-card animate-pulse" />
    )
  }

  const hasAnyData =
    overview.cashBreakdown.length > 0 ||
    overview.investments.length > 0 ||
    overview.unassignedCash !== 0

  return (
    <section className="nobli-card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <p className="nobli-kpi-label mb-1.5">Patrimônio total</p>
            <p className="font-heading text-[2.1rem] sm:text-[2.5rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tabular-nums tracking-tight leading-none">
              {formatDashboardCurrency(overview.totalPatrimony)}
            </p>
            <p className="text-[13px] text-[#5B6B84] dark:text-slate-400 mt-2 max-w-md">
              Sua evolução em direção a um amanhã mais nobre — contas + carteira de investimentos.
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
          {/* Saldo em contas */}
          <div className="rounded-2xl bg-[#F5F9FE] dark:bg-white/[0.03] border border-[#DDE7F3] dark:border-white/[0.06] p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="nobli-chip h-8 w-8 rounded-lg">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-[#0B2D6B] dark:text-slate-200">Saldo em contas</span>
            </div>
            <p className="font-heading text-xl font-bold text-[#0B2D6B] dark:text-slate-100 tabular-nums">
              {formatDashboardCurrency(overview.cashTotal)}
            </p>
            <p className="text-[11px] text-[#93A5C1] dark:text-slate-500 mt-1">
              Histórico completo · entradas − saídas por conta
            </p>
            {overview.cashBreakdown.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-[#DDE7F3] dark:border-white/[0.06] pt-3">
                {overview.cashBreakdown.slice(0, 4).map(b => (
                  <li key={b.boardId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0 truncate text-[#5B6B84] dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className={`font-semibold tabular-nums shrink-0 ${b.balance >= 0 ? 'text-[#0B2D6B] dark:text-slate-200' : 'text-red-500'}`}>
                      {formatDashboardCurrency(b.balance)}
                    </span>
                  </li>
                ))}
                {overview.cashBreakdown.length > 4 && (
                  <li className="text-[10px] text-[#93A5C1] pt-0.5">
                    + {overview.cashBreakdown.length - 4} contas ·{' '}
                    <Link href="/transactions" className="text-[#2563EB] hover:underline">ver todas</Link>
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

          {/* Investimentos */}
          <div className="rounded-2xl bg-[#F5F9FE] dark:bg-white/[0.03] border border-[#DDE7F3] dark:border-white/[0.06] p-4">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="nobli-chip h-8 w-8 rounded-lg">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-[#0B2D6B] dark:text-slate-200">Investimentos</span>
            </div>
            <p className="font-heading text-xl font-bold text-[#0B2D6B] dark:text-slate-100 tabular-nums">
              {formatDashboardCurrency(overview.investmentsTotal)}
            </p>
            <p className="text-[11px] text-[#93A5C1] dark:text-slate-500 mt-1">
              Última posição importada (XLSX)
            </p>
            {overview.investments.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-[#DDE7F3] dark:border-white/[0.06] pt-3">
                {overview.investments.map(inv => (
                  <li key={inv.boardId} className="flex items-center justify-between gap-2 text-xs">
                    <Link
                      href={`/transactions/${inv.boardId}`}
                      className="text-[#5B6B84] dark:text-slate-300 hover:text-[#2563EB] hover:underline truncate"
                    >
                      {inv.name}
                    </Link>
                    <span className="font-semibold tabular-nums text-[#0B2D6B] dark:text-slate-200 shrink-0">
                      {formatDashboardCurrency(inv.patrimonio)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#93A5C1] dark:text-slate-500 mt-3">
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
          <summary className="flex items-center gap-1.5 text-[11px] text-[#93A5C1] dark:text-slate-500 cursor-pointer list-none hover:text-[#5B6B84] dark:hover:text-slate-300">
            <Info className="h-3.5 w-3.5" />
            Como calculamos
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-2 text-[11px] text-[#5B6B84] dark:text-slate-400 space-y-1 pl-5 list-disc max-w-2xl">
            <li>Contas: soma de entradas menos saídas de cada conta.</li>
            <li>Investimentos: patrimônio informado no arquivo de posição — não somamos transações da conta de investimento aqui.</li>
            <li>Fluxo do mês (receitas/despesas abaixo) é independente e filtrado pelo período selecionado.</li>
          </ul>
        </details>
      </div>
    </section>
  )
}
