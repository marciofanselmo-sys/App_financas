'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PlannedVsActualRow, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'
import Link from 'next/link'

interface PlannedVsActualChartProps {
  data: PlannedVsActualRow[]
  loading?: boolean
}

export function PlannedVsActualChart({ data, loading }: PlannedVsActualChartProps) {
  if (loading) {
    return <div className="h-72 rounded-2xl animate-pulse bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06]" />
  }

  if (data.length === 0) {
    return (
      <ChartCard title="Planejado × Realizado" subtitle="Mês selecionado">
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500 px-4 text-center">
          <p>Configure limites por categoria no planejamento.</p>
          <Link href="/planning" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            Ir para Planejamento →
          </Link>
        </div>
      </ChartCard>
    )
  }

  const chartData = data.map(row => ({
    name: row.label.length > 14 ? `${row.label.slice(0, 14)}…` : row.label,
    fullName: row.label,
    planejado: row.planned,
    realizado: row.actual,
  }))

  return (
    <ChartCard
      title="Planejado × Realizado"
      subtitle="Top categorias com limite definido"
      href="/planning"
      linkLabel="Ver planejamento →"
    >
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36 + 40)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => formatChartCurrency(Number(value))}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="planejado" name="Planejado" fill="#94a3b8" radius={[0, 4, 4, 0]} maxBarSize={10} />
          <Bar dataKey="realizado" name="Realizado" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
