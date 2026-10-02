'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Peças visuais das telas de visão geral (Cartões & Parcelas, Recorrências…):
 * o mesmo card de número e o mesmo card de seção, para todas ficarem iguais.
 */
export function Kpi({ title, value, sub, valueClass, children }: {
  title: string; value: string; sub?: string; valueClass?: string; children?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <p className={cn('text-xl font-bold mt-1 tabular-nums text-slate-800 dark:text-slate-100', valueClass)}>{value}</p>
      {children}
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function OverviewSection({ icon: Icon, iconClass, title, subtitle, children, className }: {
  icon: LucideIcon; iconClass?: string; title: string; subtitle: string; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cn('bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5', className)}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', iconClass ?? 'text-blue-600 dark:text-blue-400')} />
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">{subtitle}</p>
      {children}
    </section>
  )
}
