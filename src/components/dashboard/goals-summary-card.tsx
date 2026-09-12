'use client'

import Link from 'next/link'
import { Target, ChevronRight } from 'lucide-react'
import { Goal } from '@/types'
import { formatDashboardCurrency } from '@/lib/dashboard-patrimony'

interface GoalsSummaryCardProps {
  goals: Goal[]
  loading?: boolean
}

export function GoalsSummaryCard({ goals, loading }: GoalsSummaryCardProps) {
  if (loading) {
    return <div className="h-28 rounded-2xl animate-pulse bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700" />
  }

  if (goals.length === 0) return null

  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
            <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Metas</p>
            <p className="text-[11px] text-slate-400">{goals.length} ativa{goals.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/goals" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
          Ver todas <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
          {formatDashboardCurrency(totalCurrent)}
        </span>
        <span className="text-xs text-slate-400">de {formatDashboardCurrency(totalTarget)}</span>
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 ml-auto">{overallPct}%</span>
      </div>

      <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {goals.slice(0, 3).map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
          return (
            <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-600 dark:text-slate-300">{g.name}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 shrink-0">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
