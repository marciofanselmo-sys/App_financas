'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CashBalancePoint, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'

interface CashBalanceTrendChartProps {
  data: CashBalancePoint[]
  loading?: boolean
}

export function CashBalanceTrendChart({ data, loading }: CashBalanceTrendChartProps) {
  if (loading) {
    return <div className="h-72 rounded-2xl animate-pulse bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06]" />
  }

  const hasData = data.some(d => d.saldo !== 0)

  return (
    <ChartCard
      title="Evolução do saldo em contas"
      subtitle="Saldo acumulado · últimos 6 meses"
    >
      {!hasData ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem histórico suficiente
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip
              formatter={(value) => formatChartCurrency(Number(value))}
              labelFormatter={label => `Fim de ${label}`}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#saldoGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
