'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PatrimonyChartData, CHART_COLORS, formatChartCurrency } from '@/lib/dashboard-charts'
import Link from 'next/link'
import { ChartPie } from 'lucide-react'

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
    return <div className="h-44 rounded-2xl bg-[#F5F9FE] dark:bg-white/[0.03] animate-pulse" />
  }

  const { assets, debts, net } = data
  const colorOf = (i: number, c?: string) => c ?? CHART_COLORS[i % CHART_COLORS.length]
  const empty = assets.length === 0 && debts.length === 0

  // Card interno do quadro "Patrimônio total", no mesmo estilo de "Saldo em
  // contas" e "Investimentos": rosca pequena à esquerda e legenda ao lado.
  return (
    <div className="rounded-2xl bg-[#F5F9FE] dark:bg-white/[0.03] border border-[#DDE7F3] dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="nobli-chip h-8 w-8 rounded-lg">
          <ChartPie className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-[#0B2D6B] dark:text-slate-200">Composição</span>
        <Link href="/investments" className="ml-auto text-[11px] font-medium text-[#2563EB] hover:underline">
          Investimentos →
        </Link>
      </div>

      {empty ? (
        <p className="text-xs text-[#93A5C1] dark:text-slate-500 py-6 text-center">Sem dados para exibir</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {assets.length > 0 ? (
              <div className="h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={assets} cx="50%" cy="50%" innerRadius={28} outerRadius={46} paddingAngle={2} dataKey="value" isAnimationActive={false}>
                      {assets.map((entry, i) => <Cell key={entry.name} fill={colorOf(i, entry.color)} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatChartCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-[#93A5C1] dark:text-slate-500">Nenhuma conta com saldo positivo</p>
            )}

            <ul className="flex-1 min-w-0 space-y-1">
              {assets.slice(0, 5).map((item, i) => (
                <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0 truncate text-[#5B6B84] dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(i, item.color) }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-semibold tabular-nums text-[#0B2D6B] dark:text-slate-200 shrink-0">
                    {formatChartCurrency(item.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {debts.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[#DDE7F3] dark:border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wide text-[#93A5C1] dark:text-slate-500 mb-1">Dívidas</p>
              <ul className="space-y-1">
                {debts.map(item => (
                  <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0 truncate text-[#5B6B84] dark:text-slate-300">
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

          <div className="mt-3 pt-2 border-t border-[#DDE7F3] dark:border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-[#5B6B84] dark:text-slate-400">Total</span>
            <span className={`font-bold tabular-nums ${net >= 0 ? 'text-[#0B2D6B] dark:text-slate-100' : 'text-red-500'}`}>
              {net < 0 ? '−' : ''}{formatChartCurrency(Math.abs(net))}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
