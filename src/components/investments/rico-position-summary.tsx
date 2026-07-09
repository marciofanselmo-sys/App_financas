'use client'

import { RICOPosition, RICOProvento } from '@/types'

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function rentColor(value: string): string {
  const n = parseFloat(value?.replace('%', '').replace(',', '.'))
  if (isNaN(n)) return 'text-slate-400'
  return n >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
}

function formatDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function posRow(pos: RICOPosition) {
  // Ganho/perda em R$ (não só %) — só dá pra calcular quando temos
  // quantidade + preço médio + preço atual (hoje só vem pra ações, não FIIs).
  const qty = pos.quantity ? Number(pos.quantity) : NaN
  const hasGainLoss = !isNaN(qty) && pos.avgPrice !== undefined && pos.lastPrice !== undefined
  const gainLoss = hasGainLoss ? (pos.lastPrice! - pos.avgPrice!) * qty : null

  return (
    <div key={pos.ticker} className="text-sm">
      <div className="flex items-center gap-2">
        <span title={pos.ticker} className="font-mono font-semibold text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded max-w-[9rem] truncate shrink-0">{pos.ticker}</span>
        {pos.quantity && <span className="text-xs text-slate-400 shrink-0">{pos.quantity} un.</span>}
        <span className="text-xs text-slate-400 shrink-0">{pos.allocation}</span>
        <span className={`text-xs font-medium shrink-0 ml-auto ${rentColor(pos.rentabilidade)}`}>{pos.rentabilidade}</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0">{formatCurrency(pos.value)}</span>
      </div>
      {(gainLoss !== null || (pos.avgPrice && pos.lastPrice)) && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 pl-[72px]">
          Preço médio {formatCurrency(pos.avgPrice ?? 0)} → {formatCurrency(pos.lastPrice ?? 0)}
          {gainLoss !== null && (
            <span className={gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
              {' '}({gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)})
            </span>
          )}
        </p>
      )}
    </div>
  )
}

// Rendimentos/dividendos/JCP já provisionados, ainda não pagos — só existe
// quando a corretora antecipa a informação no arquivo de posição.
export function ProventosBreakdown({ proventos }: { proventos: RICOProvento[] }) {
  const sorted = [...proventos].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
  const total = proventos.reduce((s, p) => s + p.netValue, 0)
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 dark:text-slate-500">Total previsto: <strong className="text-slate-600 dark:text-slate-300">{formatCurrency(total)}</strong></p>
      <div className="space-y-1.5">
        {sorted.map((p, i) => (
          <div key={`${p.ticker}-${p.paymentDate}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="font-mono font-semibold text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded w-16 text-center shrink-0">{p.ticker}</span>
            <span className="text-xs text-slate-400 shrink-0">{p.event}</span>
            <span className="text-xs text-slate-400 shrink-0 ml-auto">{formatDateBR(p.paymentDate)}</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 shrink-0 w-20 text-right">{formatCurrency(p.netValue)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Mesma organização por categoria/subcategoria usada em Metas ao importar
// posição da RICO.
export function PositionsBreakdown({ positions }: { positions: RICOPosition[] }) {
  const cats = Array.from(new Set(positions.map(p => p.category).filter(Boolean)))
  if (cats.length === 0) {
    return <div className="space-y-2">{positions.map(posRow)}</div>
  }
  return (
    <div className="space-y-4">
      {cats.map(cat => {
        const catPos = positions.filter(p => p.category === cat)
        const subs = Array.from(new Set(catPos.map(p => p.subcategory))).filter(Boolean)
        return (
          <div key={cat}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{cat}</p>
            {subs.length > 0 ? subs.map(sub => (
              <div key={sub} className="mb-3">
                {subs.length > 1 && <p className="text-xs text-slate-400 mb-1.5 pl-1">{sub}</p>}
                <div className="space-y-2">{catPos.filter(p => p.subcategory === sub).map(posRow)}</div>
              </div>
            )) : <div className="space-y-2">{catPos.map(posRow)}</div>}
          </div>
        )
      })}
    </div>
  )
}

const CATEGORY_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4']

// Resumo rápido de "o que tem dentro da conta" — quanto está em cada
// categoria (Fundos Imobiliários, Ações...) e o peso de cada uma no total
// investido em ativos.
export function CategorySummary({ positions }: { positions: RICOPosition[] }) {
  const totalInvestido = positions.reduce((s, p) => s + p.value, 0)
  const totals = Array.from(
    positions.reduce((map, p) => map.set(p.category, (map.get(p.category) ?? 0) + p.value), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({ category, value, pct: totalInvestido > 0 ? (value / totalInvestido) * 100 : 0 }))

  if (totals.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-700">
        {totals.map((t, i) => (
          <div key={t.category} style={{ width: `${t.pct}%`, backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {totals.map((t, i) => (
          <div key={t.category} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
            <span className="text-slate-500 dark:text-slate-400">{t.category}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(t.value)}</span>
            <span className="text-slate-400">({t.pct.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
