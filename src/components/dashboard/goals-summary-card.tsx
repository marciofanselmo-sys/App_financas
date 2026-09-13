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
    return <div className="h-28 nobli-card animate-pulse" />
  }

  if (goals.length === 0) return null

  const totalCurrent = goals.reduce((s, g) => s + g.currentAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalCurrent / totalTarget) * 100)) : 0

  return (
    <div className="nobli-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="nobli-chip h-8 w-8 rounded-lg">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <p className="nobli-card-title">Meus objetivos</p>
            <p className="text-[11px] text-[#93A5C1] dark:text-slate-500">{goals.length} ativa{goals.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/goals" className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-0.5">
          Ver todos <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-heading text-xl font-bold text-[#0B2D6B] dark:text-slate-100 tabular-nums">
          {formatDashboardCurrency(totalCurrent)}
        </span>
        <span className="text-xs text-[#93A5C1] dark:text-slate-500">de {formatDashboardCurrency(totalTarget)}</span>
        <span className="text-xs font-bold text-[#2563EB] dark:text-blue-400 ml-auto">{overallPct}%</span>
      </div>

      <div className="h-2 bg-[#E8F2FF] dark:bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <ul className="space-y-2.5">
        {goals.slice(0, 3).map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0
          return (
            <li key={g.id}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <span className="truncate font-medium text-[#1F2937] dark:text-slate-300">{g.name}</span>
                <span className="font-semibold text-[#5B6B84] dark:text-slate-400 shrink-0 tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 bg-[#E8F2FF] dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2563EB]/80 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
