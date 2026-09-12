'use client'

import Link from 'next/link'
import { PiggyBank, Settings2 } from 'lucide-react'
import { formatDashboardCurrency } from '@/lib/dashboard-patrimony'

interface InvestMonthCardProps {
  monthlyIncome: number
  investmentTarget: number
  actualContributions?: number
  loading?: boolean
}

export function InvestMonthCard({ monthlyIncome, investmentTarget, actualContributions = 0, loading }: InvestMonthCardProps) {
  if (loading) {
    return <div className="h-28 rounded-2xl animate-pulse bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700" />
  }

  const hasPlan = investmentTarget > 0
  const incomeBase = monthlyIncome > 0 ? monthlyIncome : 0
  const pct = incomeBase > 0 && hasPlan ? Math.round((investmentTarget / incomeBase) * 100) : null
  const contributionPct = hasPlan && investmentTarget > 0
    ? Math.min(999, Math.round((actualContributions / investmentTarget) * 100))
    : null

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 shadow-md shadow-emerald-900/20 text-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Este mês</p>
            <p className="text-sm font-semibold">Investir</p>
          </div>
        </div>
        {hasPlan && pct != null && (
          <span className="text-xs font-bold bg-white/15 px-2 py-1 rounded-lg">{pct}% da receita</span>
        )}
      </div>

      {hasPlan ? (
        <>
          <p className="text-2xl font-bold tabular-nums">{formatDashboardCurrency(investmentTarget)}</p>
          <p className="text-xs text-white/70 mt-1">
            Meta do planejamento
            {incomeBase > 0 && <> · receita do período: {formatDashboardCurrency(incomeBase)}</>}
          </p>
          {actualContributions > 0 && (
            <p className="text-xs text-white/90 mt-2 pt-2 border-t border-white/15">
              Aportado: <strong>{formatDashboardCurrency(actualContributions)}</strong>
              {contributionPct != null && <> · {contributionPct}% da meta</>}
            </p>
          )}
          {actualContributions === 0 && (
            <p className="text-[11px] text-white/60 mt-2">
              Aportes: transferências para contas de investimento
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-white/90 leading-relaxed">
            Defina quanto investir este mês no planejamento.
          </p>
          <Link
            href="/planning"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configurar planejamento
          </Link>
        </>
      )}
    </div>
  )
}
