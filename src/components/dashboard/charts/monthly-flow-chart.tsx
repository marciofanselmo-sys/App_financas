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
    return <div className="h-72 nobli-card animate-pulse" />
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
            <CartesianGrid strokeDasharray="3 3" className="stroke-[#E8F2FF] dark:stroke-white/10" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#93A5C1' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#93A5C1' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip
              formatter={(value) => formatChartCurrency(Number(value))}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #DDE7F3',
                boxShadow: 'var(--nobli-shadow-s)',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={v => <span className="text-slate-600 dark:text-slate-300">{v}</span>}
            />
            <Bar dataKey="receita" name="Receita" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="despesa" name="Despesa" fill="#F87171" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
