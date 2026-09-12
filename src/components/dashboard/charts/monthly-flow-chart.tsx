'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { MonthlyFlowPoint, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'

interface MonthlyFlowChartProps {
  data: MonthlyFlowPoint[]
  loading?: boolean
}

export function MonthlyFlowChart({ data, loading }: MonthlyFlowChartProps) {
  if (loading) {
    return <div className="h-72 rounded-2xl animate-pulse bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06]" />
  }

  const hasData = data.some(d => d.receita > 0 || d.despesa > 0)

  return (
    <ChartCard
      title="Receitas × Despesas"
      subtitle="Últimos 6 meses · contas (sem investimento)"
      href="/analytics"
    >
      {!hasData ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem movimentação nos últimos 6 meses
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--chart-axis, #94a3b8)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--chart-axis, #94a3b8)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip
              formatter={(value) => formatChartCurrency(Number(value))}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,0.2)',
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={v => <span className="text-slate-600 dark:text-slate-300">{v}</span>}
            />
            <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
