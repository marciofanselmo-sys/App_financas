'use client'

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { YearMonthPoint, YoYBalancePoint } from '@/lib/report-charts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

interface AnnualFlowChartProps {
  data: YearMonthPoint[]
  year: number
}

export function AnnualFlowChart({ data, year }: AnnualFlowChartProps) {
  const hasData = data.some(m => m.receita > 0 || m.despesa > 0)
  if (!hasData) return null

  return (
    <div className="print:hidden mb-6">
      <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3">
        Receitas × Despesas — {year}
      </h3>
      <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-3">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip formatter={(v) => formatChartCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface YoYComparisonChartProps {
  balanceData: YoYBalancePoint[]
  incomeData: YoYBalancePoint[]
  currentYear: number
  previousYear: number
}

export function YoYComparisonChart({ balanceData, incomeData, currentYear, previousYear }: YoYComparisonChartProps) {
  const hasData = balanceData.some(m => m.atual !== 0 || m.anterior !== 0)
    || incomeData.some(m => m.atual !== 0 || m.anterior !== 0)
  if (!hasData) return null

  return (
    <div className="print:hidden space-y-6 mb-6">
      <div>
        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1">
          Comparativo ano a ano — Saldo mensal
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {currentYear} vs {previousYear}
        </p>
        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-3">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={balanceData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                width={44}
              />
              <Tooltip formatter={(v) => formatChartCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="atual" name={String(currentYear)} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="anterior" name={String(previousYear)} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1">
          Comparativo ano a ano — Receitas
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {currentYear} vs {previousYear}
        </p>
        <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={incomeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                width={44}
              />
              <Tooltip formatter={(v) => formatChartCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="atual" name={String(currentYear)} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="anterior" name={String(previousYear)} fill="#86efac" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
