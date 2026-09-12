'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartSegment, CHART_COLORS, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'

interface ExpenseDistributionChartProps {
  data: ChartSegment[]
  loading?: boolean
}

export function ExpenseDistributionChart({ data, loading }: ExpenseDistributionChartProps) {
  if (loading) {
    return <div className="h-72 rounded-2xl animate-pulse bg-white dark:bg-[#111c2d] border border-slate-100 dark:border-white/[0.06]" />
  }

  const top = data.slice(0, 6)
  const rest = data.slice(6).reduce((s, d) => s + d.value, 0)
  const chartData = rest > 0 ? [...top, { name: 'Outros', value: rest }] : top

  return (
    <ChartCard
      title="Despesas por categoria"
      subtitle="Mês selecionado"
      href="/analytics"
      linkLabel="Ver análise →"
    >
      {chartData.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Nenhuma despesa no período
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatChartCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-1 space-y-1 px-2">
            {chartData.map((item, i) => (
              <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-600 dark:text-slate-300">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                  {formatChartCurrency(item.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  )
}
