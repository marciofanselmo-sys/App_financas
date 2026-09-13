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
    return <div className="h-72 nobli-card animate-pulse" />
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
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={v => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip
              formatter={(value) => formatChartCurrency(Number(value))}
              labelFormatter={label => `Fim de ${label}`}
              contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #DDE7F3', boxShadow: 'var(--nobli-shadow-s)' }}
            />
            <Area
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="#2563EB"
              strokeWidth={2.5}
              fill="url(#saldoGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
