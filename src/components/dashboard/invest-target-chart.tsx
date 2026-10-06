'use client'

import { useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

export interface InvestTargetMonthPoint {
  label: string
  meta: number
  aportes: number
}

interface InvestTargetChartProps {
  data: InvestTargetMonthPoint[]
  loading?: boolean
}

// A meta vale até ser trocada: mês sem plano próprio herda o anterior,
// igual ao Planejamento. Antes do primeiro plano salvo não há meta (null),
// em vez de um zero que parecia "meta de R$ 0".
function carryMeta(data: InvestTargetMonthPoint[]) {
  const out: { label: string; meta: number | null; aportes: number }[] = []
  for (const d of data) {
    const prev = out.length > 0 ? out[out.length - 1].meta : null
    out.push({ label: d.label, meta: d.meta > 0 ? d.meta : prev, aportes: d.aportes })
  }
  return out
}

export function InvestTargetChart({ data, loading }: InvestTargetChartProps) {
  const series = useMemo(() => carryMeta(data), [data])

  if (loading) {
    return <div className="h-64 nobli-card animate-pulse" />
  }

  const hasData = data.some(d => d.meta > 0 || d.aportes > 0)
  if (!hasData) return null

  const totalAportes = series.reduce((s, d) => s + d.aportes, 0)
  // O percentual compara só os meses que TÊM meta: antes o aporte dos 6 meses
  // era dividido pela meta de um mês só (o único com plano) e dava "909%".
  const withMeta = series.filter(d => d.meta !== null && d.meta > 0)
  const totalMeta = withMeta.reduce((s, d) => s + (d.meta ?? 0), 0)
  const aportesWithMeta = withMeta.reduce((s, d) => s + d.aportes, 0)
  const pct = totalMeta > 0 ? Math.round((aportesWithMeta / totalMeta) * 100) : null
  const allMonthsHaveMeta = withMeta.length === series.length

  return (
    <div className="nobli-card overflow-hidden">
      <div className="px-5 pt-5 pb-2 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Meta investir × Aportes reais</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Aportes = dinheiro enviado para contas de investimento · últimos 6 meses
          </p>
        </div>
        {/* O resumo em números: com poucos meses preenchidos, é ele que conta a história */}
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-[#0B2D6B] dark:text-slate-100">
            {formatChartCurrency(totalAportes)}
            {totalMeta > 0 && allMonthsHaveMeta && (
              <span className="text-xs font-medium text-slate-400"> de {formatChartCurrency(totalMeta)}</span>
            )}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {pct === null
              ? 'aportado no período'
              : allMonthsHaveMeta
                ? `${pct}% da meta no período`
                : `aportado em 6 meses · ${pct}% da meta ${withMeta.length === 1 ? 'no mês com meta' : `nos ${withMeta.length} meses com meta`}`}
          </p>
        </div>
      </div>
      <div className="px-3 pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
              width={44}
            />
            <Tooltip
              formatter={(v) => (v === null || v === undefined ? '—' : formatChartCurrency(Number(v)))}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={value => <span className="text-slate-500 dark:text-slate-400">{value}</span>}
            />
            <Line
              type="stepAfter"
              dataKey="meta"
              name="Meta"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="6 4"
              // Ponto em cada mês: com a meta em um mês só, a linha sozinha não aparece.
              dot={{ r: 3, fill: '#94a3b8', strokeWidth: 0 }}
              connectNulls={false}
            />
            <Line
              type="linear"
              dataKey="aportes"
              name="Aportes"
              stroke="#2563EB"
              strokeWidth={2}
              dot={{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
