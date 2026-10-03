'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ComposedChart, Line, Legend } from 'recharts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

// Barras simples mês a mês, no mesmo desenho dos gráficos do Relatório Anual.
const HEIGHT = 240
const axisTick = { fontSize: 10, fill: '#94a3b8' }
const kFormat = (v: unknown) => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))

type Point = { label: string } & Record<string, number | string>

/**
 * Um valor em reais por mês. Com `percentKey`, cada barra ganha em cima o
 * percentual da renda daquele mês — um eixo só, sem misturar escalas.
 */
export function MonthAmountChart({ data, dataKey, name, color, percentKey }: {
  data: Point[]; dataKey: string; name: string; color: string; percentKey?: string
}) {
  const pctLabel = (v: unknown) => (Number(v) > 0 ? `${Math.round(Number(v))}%` : '')
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: percentKey ? 20 : 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
          formatter={(v, _n, item) => {
            const pct = percentKey ? Number((item?.payload as Record<string, unknown>)?.[percentKey] ?? 0) : null
            return [`${formatChartCurrency(Number(v))}${pct ? ` · ${pct.toFixed(1).replace('.', ',')}% da renda` : ''}`, name]
          }}
        />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={36}>
          {percentKey && <LabelList dataKey={percentKey} position="top" formatter={pctLabel} style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Aportes do mês (barras) × meta de investir (linha tracejada em degrau),
 * no mesmo eixo em reais. Mês sem meta própria herda a do mês anterior.
 */
export function ContributionsVsTargetChart({ data }: { data: { label: string; aportes: number; meta: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip formatter={v => (v === null || v === undefined ? '—' : formatChartCurrency(Number(v)))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="aportes" name="Aportes" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Line type="stepAfter" dataKey="meta" name="Meta" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0 }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
