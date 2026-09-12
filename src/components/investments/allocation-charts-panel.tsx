'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { TransactionBoard } from '@/types'
import {
  aggregateConsolidatedAllocation,
  aggregateBoardAllocations,
  aggregateTopAssets,
  totalInvestmentPatrimony,
  hasInvestmentChartData,
} from '@/lib/investment-charts'
import { CHART_COLORS, formatChartCurrency } from '@/lib/dashboard-charts'
import { TrendingUp } from 'lucide-react'

interface AllocationChartsPanelProps {
  boards: TransactionBoard[]
}

function DonutBlock({ title, subtitle, data }: { title: string; subtitle?: string; data: { name: string; value: number }[] }) {
  if (data.length === 0) return null

  return (
    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-4">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 mb-3">{subtitle}</p>}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value">
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatChartCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 space-y-1">
        {data.slice(0, 5).map((item, i) => (
          <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums shrink-0">{formatChartCurrency(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AllocationChartsPanel({ boards }: AllocationChartsPanelProps) {
  if (!hasInvestmentChartData(boards)) return null

  const consolidated = aggregateConsolidatedAllocation(boards)
  const byBoard = aggregateBoardAllocations(boards)
  const topAssets = aggregateTopAssets(boards, 10)
  const total = totalInvestmentPatrimony(boards)

  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Alocação da carteira</h2>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Patrimônio total importado: <strong className="text-slate-700 dark:text-slate-200">{formatChartCurrency(total)}</strong>
        </p>
      </div>

      <div className="p-5 space-y-4">
        <DonutBlock title="Todas as contas" subtitle="Por classe de ativo" data={consolidated} />

        {byBoard.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {byBoard.map(board => (
              <DonutBlock
                key={board.boardId}
                title={board.name}
                subtitle={formatChartCurrency(board.patrimonio)}
                data={board.segments}
              />
            ))}
          </div>
        )}

        {topAssets.length > 0 && (
          <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-white/[0.06] p-4">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Top 10 ativos</p>
            <ResponsiveContainer width="100%" height={Math.max(200, topAssets.length * 28)}>
              <BarChart data={topAssets} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                />
                <YAxis
                  type="category"
                  dataKey="ticker"
                  width={72}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => formatChartCurrency(Number(v))}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as typeof topAssets[0] | undefined
                    return row ? `${row.ticker} · ${row.boardName}` : ''
                  }}
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {topAssets.map((row, i) => (
                    <Cell key={row.ticker + row.boardName} fill={row.boardColor || CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
