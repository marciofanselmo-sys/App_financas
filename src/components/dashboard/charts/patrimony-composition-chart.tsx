'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PatrimonyChartData, CHART_COLORS, formatChartCurrency } from '@/lib/dashboard-charts'
import { ChartCard } from './chart-card'

interface PatrimonyCompositionChartProps {
  data: PatrimonyChartData
  loading?: boolean
}

/**
 * Composição do patrimônio: contas correntes e investimentos (cartões de
 * crédito ficam fora). Conta corrente negativa (cheque especial) aparece à
 * parte, em vermelho.
 *
 * Dívida não entra na rosca de propósito — ela não desenha valor negativo, e
 * a versão antiga contornava isso com Math.abs(), mostrando o cartão devendo
 * R$ 478 como R$ 478 de patrimônio.
 */
export function PatrimonyCompositionChart({ data, loading }: PatrimonyCompositionChartProps) {
  if (loading) {
    return <div className="h-72 nobli-card animate-pulse" />
  }

  const { assets, debts, net } = data
  const colorOf = (i: number, c?: string) => c ?? CHART_COLORS[i % CHART_COLORS.length]
  const empty = assets.length === 0 && debts.length === 0

  return (
    <ChartCard
      title="Composição do patrimônio"
      subtitle="Contas correntes + investimentos"
      href="/investments"
      linkLabel="Investimentos →"
    >
      {empty ? (
        <div className="h-56 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          Sem dados para exibir
        </div>
      ) : (
        <>
          {assets.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={assets} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} dataKey="value">
                  {assets.map((entry, i) => <Cell key={entry.name} fill={colorOf(i, entry.color)} />)}
                </Pie>
                <Tooltip formatter={(value) => formatChartCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-24 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              Nenhuma conta com saldo positivo
            </div>
          )}

          <ul className="mt-1 space-y-1 px-2 max-h-24 overflow-y-auto">
            {assets.slice(0, 6).map((item, i) => (
              <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(i, item.color) }} />
                  {item.name}
                </span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                  {formatChartCurrency(item.value)}
                </span>
              </li>
            ))}
          </ul>

          {debts.length > 0 && (
            <div className="mt-3 mx-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Dívidas</p>
              <ul className="space-y-1">
                {debts.map(item => (
                  <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0 truncate text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-semibold tabular-nums text-red-500 shrink-0">
                      −{formatChartCurrency(item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 mx-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Total</span>
            <span className={`font-bold tabular-nums ${net >= 0 ? 'text-[#0B2D6B] dark:text-slate-100' : 'text-red-500'}`}>
              {net < 0 ? '−' : ''}{formatChartCurrency(Math.abs(net))}
            </span>
          </div>
        </>
      )}
    </ChartCard>
  )
}
