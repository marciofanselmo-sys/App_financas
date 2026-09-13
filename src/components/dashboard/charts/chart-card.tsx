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
    <div className={`nobli-card overflow-hidden ${className}`}>
      <div className="px-5 pt-5 pb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="nobli-card-title">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#93A5C1] dark:text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {href && (
          <Link href={href} className="text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:underline shrink-0">
            {linkLabel}
          </Link>
        )}
      </div>
      <div className="px-3 pb-4">{children}</div>
    </div>
  )
}
