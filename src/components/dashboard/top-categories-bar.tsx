import Link from 'next/link'
import { Transaction } from '@/types'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface TopCategoriesBarProps {
  transactions: Transaction[]
}

export function TopCategoriesBar({ transactions }: TopCategoriesBarProps) {
  const catMap: Record<string, number> = {}
  transactions.filter(t => t.type === 'despesa').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount)
  })

  const data = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const max = data[0]?.value || 1

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma despesa no período</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Top 5 Gastos</h3>
        <Link href="/analytics" className="text-xs text-blue-600 hover:underline">
          Ver análise →
        </Link>
      </div>
      <div className="space-y-3.5">
        {data.map((item, i) => {
          const pct = Math.round((item.value / max) * 100)
          return (
            <div key={item.name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[140px] font-medium">
                  {item.name}
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 ml-2">
                  {fmt(item.value)}
                </span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
