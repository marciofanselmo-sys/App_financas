'use client'

import { IncomeCommitmentSegment, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'

interface IncomeCommitmentChartProps {
  segments: IncomeCommitmentSegment[]
  hasIncome: boolean
  monthlyIncome: number
  loading?: boolean
}

export function IncomeCommitmentChart({
  segments,
  hasIncome,
  monthlyIncome,
  loading,
}: IncomeCommitmentChartProps) {
  if (loading) {
    return <div className="h-72 rounded-2xl animate-pulse bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06]" />
  }

  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const base = hasIncome ? monthlyIncome : total

  return (
    <ChartCard
      title="Comprometimento da renda"
      subtitle={hasIncome ? 'Fixos + parcelas + variável vs receita do mês' : 'Sem receita no período'}
      href="/fixos"
      linkLabel="Ver fixos →"
    >
      {total <= 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhum compromisso ou despesa registrada
        </div>
      ) : (
        <div className="px-2 py-2">
          <div className="h-8 rounded-xl overflow-hidden flex w-full bg-slate-100 dark:bg-white/10">
            {segments.map(seg => {
              const pct = base > 0 ? (seg.value / base) * 100 : 0
              if (pct <= 0) return null
              return (
                <div
                  key={seg.name}
                  className="h-full transition-all min-w-[2px]"
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                  title={`${seg.name}: ${formatChartCurrency(seg.value)}`}
                />
              )
            })}
          </div>
          <ul className="mt-4 space-y-2">
            {segments.map(seg => {
              const pct = base > 0 ? Math.round((seg.value / base) * 100) : 0
              return (
                <li key={seg.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                    {seg.name}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatChartCurrency(seg.value)}
                    {hasIncome && pct > 0 && (
                      <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">({pct}%)</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          {hasIncome && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 px-1">
              Base: receita do mês {formatChartCurrency(monthlyIncome)}
            </p>
          )}
        </div>
      )}
    </ChartCard>
  )
}
