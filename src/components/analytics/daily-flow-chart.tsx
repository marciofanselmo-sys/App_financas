'use client'

import { useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { DailyFlowPoint, hasDailyFlowActivity } from '@/lib/analytics-charts'
import { formatChartCurrency } from '@/lib/dashboard-charts'
import { CalendarDays } from 'lucide-react'

type FlowMode = 'daily' | 'cumulative'

interface DailyFlowChartProps {
  data: DailyFlowPoint[]
  month: number
  year: number
  loading?: boolean
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function DailyFlowChart({ data, month, year, loading }: DailyFlowChartProps) {
  const [mode, setMode] = useState<FlowMode>('daily')

  if (loading) {
    return <div className="h-72 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm border border-slate-100 dark:border-slate-700" />
  }

  const active = hasDailyFlowActivity(data)

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Fluxo do mês</h2>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {MONTH_NAMES[month - 1]} {year} · dia a dia ou acumulado
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'daily'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Por dia
          </button>
          <button
            type="button"
            onClick={() => setMode('cumulative')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'cumulative'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Acumulado
          </button>
        </div>
      </div>

      <div className="px-3 pb-4">
        {!active ? (
          <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            Sem movimentação neste mês
          </div>
        ) : mode === 'daily' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                width={44}
              />
              <Tooltip
                formatter={(value) => formatChartCurrency(Number(value))}
                labelFormatter={label => `Dia ${label}`}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" name="Entrada" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={12} />
              <Bar dataKey="despesa" name="Saída" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="saldoMesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                width={44}
              />
              <Tooltip
                formatter={(value) => formatChartCurrency(Number(value))}
                labelFormatter={label => `Até dia ${label}`}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="saldoAcum" name="Saldo acumulado" stroke="#3b82f6" strokeWidth={2} fill="url(#saldoMesGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
