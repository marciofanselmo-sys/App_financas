'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

export interface InvestTargetMonthPoint {
  label: string
  meta: number
  aportes: number
}

interface InvestTargetChartProps {
  data: InvestTargetMonthPoint[]
  loading?: boolean
}

export function InvestTargetChart({ data, loading }: InvestTargetChartProps) {
  if (loading) {
    return <div className="h-64 nobli-card animate-pulse" />
  }

  const hasData = data.some(d => d.meta > 0 || d.aportes > 0)
  if (!hasData) return null

  return (
    <div className="nobli-card overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Meta investir × Aportes reais</h3>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Aportes = dinheiro enviado para contas de investimento · últimos 6 meses
        </p>
      </div>
      <div className="px-3 pb-4">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip formatter={(v) => formatChartCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="meta" name="Meta" fill="#BFD6F6" radius={[6, 6, 0, 0]} maxBarSize={24} />
            <Bar dataKey="aportes" name="Aportes" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
