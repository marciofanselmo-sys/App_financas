'use client'

import { PatrimonyVariation } from '@/lib/position-history'
import { formatChartCurrency } from '@/lib/dashboard-charts'
import { TrendingDown, TrendingUp, Minus, ArrowRightLeft } from 'lucide-react'

interface PatrimonyVariationCardProps {
  variation: PatrimonyVariation
}

function formatDeltaPercent(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1).replace('.', ',')}%`
}

export function PatrimonyVariationCard({ variation }: PatrimonyVariationCardProps) {
  const { current, previous, delta, deltaPercent, canCompare, currentLabel, previousLabel } = variation

  const isFlat = canCompare && delta === 0
  const isUp = canCompare && delta != null && delta > 0
  const isDown = canCompare && delta != null && delta < 0

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Patrimônio importado · consolidado
              </p>
            </div>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums tracking-tight">
              {formatChartCurrency(current)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Última importação · {currentLabel}
            </p>
          </div>

          {canCompare && previous != null && previousLabel ? (
            <div
              className={`rounded-xl border px-4 py-3 sm:min-w-[220px] ${
                isUp
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : isDown
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {isUp && <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                {isDown && <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />}
                {isFlat && <Minus className="h-4 w-4 text-slate-400" />}
                <span
                  className={`text-xs font-semibold ${
                    isUp
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : isDown
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isFlat ? 'Sem alteração' : 'vs importação anterior'}
                </span>
              </div>
              {!isFlat && delta != null && (
                <p
                  className={`text-lg font-bold tabular-nums ${
                    isUp
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {formatChartCurrency(delta)}
                  {deltaPercent != null && (
                    <span className="text-sm font-semibold ml-1.5 opacity-90">
                      ({formatDeltaPercent(deltaPercent)})
                    </span>
                  )}
                </p>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Anterior · {previousLabel} · {formatChartCurrency(previous)}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] px-4 py-3 sm:max-w-xs">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Importe a posição de novo em outro momento para ver quanto mudou.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
