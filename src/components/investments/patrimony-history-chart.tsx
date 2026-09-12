'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { PatrimonyHistoryPoint } from '@/lib/position-history'
import { formatChartCurrency } from '@/lib/dashboard-charts'
import { History } from 'lucide-react'

interface PatrimonyHistoryChartProps {
  data: PatrimonyHistoryPoint[]
  title?: string
  subtitle?: string
}

export function PatrimonyHistoryChart({ data, title = 'Evolução do patrimônio', subtitle }: PatrimonyHistoryChartProps) {
  if (data.length < 2) {
    return (
      <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Importe a posição pelo menos duas vezes para ver a evolução.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
            width={48}
          />
          <Tooltip
            formatter={(v) => formatChartCurrency(Number(v))}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as PatrimonyHistoryPoint | undefined
              if (!row) return ''
              return row.boardName ? `${row.boardName} · ${row.label}` : row.label
            }}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Line type="monotone" dataKey="patrimonio" name="Patrimônio" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
