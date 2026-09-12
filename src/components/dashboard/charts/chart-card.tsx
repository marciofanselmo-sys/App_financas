'use client'

import Link from 'next/link'
import { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
  children: ReactNode
  className?: string
}

export function ChartCard({
  title,
  subtitle,
  href,
  linkLabel = 'Ver mais →',
  children,
  className = '',
}: ChartCardProps) {
  return (
    <div
      className={`bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-5 pt-5 pb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link href={href} className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="px-3 pb-4">{children}</div>
    </div>
  )
}
