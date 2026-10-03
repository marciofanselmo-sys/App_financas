'use client'

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { YearMonthPoint, YoYBalancePoint } from '@/lib/report-charts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

// Os três gráficos do Relatório Anual, só o desenho — o título e o card vêm
// de quem usa (OverviewSection), para ficarem lado a lado no mesmo padrão.
const HEIGHT = 260
const axisTick = { fontSize: 10, fill: '#94a3b8' }
const kFormat = (v: unknown) => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))
const tooltip = { formatter: (v: unknown) => formatChartCurrency(Number(v)), contentStyle: { borderRadius: 12, fontSize: 12 } }

export function hasYearData(data: YearMonthPoint[]) {
  return data.some(m => m.receita > 0 || m.despesa > 0)
}

/** Receitas × Despesas de cada mês do ano. */
export function AnnualFlowChart({ data }: { data: YearMonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Saldo de cada mês, ano atual contra o anterior. */
export function YoYBalanceChart({ data, currentYear, previousYear }: { data: YoYBalancePoint[]; currentYear: number; previousYear: number }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="atual" name={String(currentYear)} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="anterior" name={String(previousYear)} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Receitas de cada mês, ano atual contra o anterior. */
export function YoYIncomeChart({ data, currentYear, previousYear }: { data: YoYBalancePoint[]; currentYear: number; previousYear: number }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="atual" name={String(currentYear)} fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="anterior" name={String(previousYear)} fill="#86efac" radius={[3, 3, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}
