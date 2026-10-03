'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

// Barras simples mês a mês, no mesmo desenho dos gráficos do Relatório Anual.
const HEIGHT = 240
const axisTick = { fontSize: 10, fill: '#94a3b8' }
const kFormat = (v: unknown) => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))

type Point = { label: string } & Record<string, number | string>

/** Um valor em reais por mês. */
export function MonthAmountChart({ data, dataKey, name, color }: { data: Point[]; dataKey: string; name: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip formatter={v => formatChartCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Um percentual por mês (ex.: quanto da renda foi para algo). */
export function MonthPercentChart({ data, dataKey, name, color }: { data: Point[]; dataKey: string; name: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={40} />
        <Tooltip formatter={v => `${Number(v).toFixed(1).replace('.', ',')}% da renda`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
