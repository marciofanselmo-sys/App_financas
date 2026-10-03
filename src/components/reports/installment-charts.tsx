'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts'
import { formatChartCurrency } from '@/lib/dashboard-charts'

// Gráficos do Relatório de Parcelas, no mesmo desenho dos do Relatório Anual.
const HEIGHT = 240
const axisTick = { fontSize: 10, fill: '#94a3b8' }
const kFormat = (v: unknown) => (Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))

export interface InstallmentMonthPoint {
  label: string
  novas: number   // valor cheio das compras parceladas que começaram no mês
  pago: number    // parcelas pagas no mês
  peso: number    // % das receitas do mês que foi para parcelas
}

/**
 * Compras novas parceladas × parcelas pagas, mês a mês. Em cima da barra de
 * parcelas pagas vai quanto isso foi da renda do mês — um eixo só.
 */
export function NewVsPaidChart({ data }: { data: InstallmentMonthPoint[] }) {
  const pctLabel = (v: unknown) => (Number(v) > 0 ? `${Math.round(Number(v))}%` : '')
  return (
    <ResponsiveContainer width="100%" height={HEIGHT}>
      <BarChart data={data} margin={{ top: 20, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={kFormat} width={40} />
        <Tooltip
          contentStyle={{ borderRadius: 12, fontSize: 12 }}
          formatter={(v, n, item) => {
            const peso = Number((item?.payload as InstallmentMonthPoint | undefined)?.peso ?? 0)
            const extra = n === 'Parcelas pagas' && peso > 0 ? ` · ${peso.toFixed(1).replace('.', ',')}% da renda` : ''
            return [`${formatChartCurrency(Number(v))}${extra}`, n]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="novas" name="Comprado parcelado" fill="#7c3aed" radius={[3, 3, 0, 0]} maxBarSize={22} />
        <Bar dataKey="pago" name="Parcelas pagas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={22}>
          <LabelList dataKey="peso" position="top" formatter={pctLabel} style={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
