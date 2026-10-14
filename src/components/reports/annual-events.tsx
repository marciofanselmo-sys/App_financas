'use client'

import { Sparkles } from 'lucide-react'
import type { AppEvent, Category, Transaction } from '@/types'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const pct = (v: number, total: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '—')
const ddmm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/')

export interface EventYearStat {
  event: AppEvent
  total: number
  count: number
  first: string
  last: string
  /** Por categoria-mãe, do maior para o menor. */
  byCategory: { name: string; amount: number; color: string }[]
}

/**
 * Gastos do ano por evento. O dinheiro do evento JÁ está nas categorias
 * (o evento é uma etiqueta por cima) — isto é outro jeito de ver, não soma.
 */
export function eventYearStats(expenses: Transaction[], events: AppEvent[], categories: Category[]) {
  const mothers = motherNameByCategory(categories)
  const byId = new Map(events.map(e => [e.id, e]))
  const acc = new Map<string, { total: number; count: number; first: string; last: string; cats: Map<string, number> }>()
  const byMother = new Map<string, number>()
  for (const t of expenses) {
    if (t.type !== 'despesa' || !t.event_id || !byId.has(t.event_id)) continue
    const amt = Number(t.amount)
    const mother = motherOf(t.category, mothers, t.type)
    const a = acc.get(t.event_id) ?? { total: 0, count: 0, first: t.date, last: t.date, cats: new Map() }
    a.total += amt
    a.count++
    if (t.date < a.first) a.first = t.date
    if (t.date > a.last) a.last = t.date
    a.cats.set(mother, (a.cats.get(mother) ?? 0) + amt)
    acc.set(t.event_id, a)
    byMother.set(mother, (byMother.get(mother) ?? 0) + amt)
  }
  const stats: EventYearStat[] = [...acc.entries()].map(([id, a]) => ({
    event: byId.get(id)!,
    total: a.total,
    count: a.count,
    first: a.first,
    last: a.last,
    byCategory: [...a.cats.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([name, amount]) => ({ name, amount, color: categories.find(c => c.name === name)?.color ?? '#94a3b8' })),
  })).sort((x, y) => y.total - x.total)
  return { stats, total: stats.reduce((s, e) => s + e.total, 0), byMother: Object.fromEntries(byMother) }
}

export function AnnualEventsSection({ stats, total, totalExpenses, totalIncome }: {
  stats: EventYearStat[]
  total: number
  totalExpenses: number
  totalIncome: number
}) {
  if (stats.length === 0) return null
  const dayToDay = Math.max(0, totalExpenses - total)
  const balanceWithout = totalIncome - dayToDay
  const share = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0

  return (
    <OverviewSection
      icon={Sparkles}
      iconClass="text-violet-600 dark:text-violet-400"
      title="Eventos do ano"
      subtitle="Quanto custou cada viagem, festa ou projeto. Esses gastos já estão nas categorias acima — aqui é outro jeito de ver, não soma de novo."
    >
      <div className="mt-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] print:bg-slate-50 p-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total em eventos</p>
          <p className="text-lg font-bold tabular-nums text-violet-600 dark:text-violet-400 print:text-violet-600">{fmt(total)}</p>
          <p className="text-[11px] text-slate-400">{pct(total, totalExpenses)} das despesas · {stats.length} evento{stats.length === 1 ? '' : 's'}</p>
        </div>
        <div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08]">
            <div className="bg-violet-500" style={{ width: `${Math.min(100, share)}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>Eventos {fmt(total)}</span>
            <span>Dia a dia {fmt(dayToDay)}</span>
          </div>
        </div>
        {totalIncome > 0 && (
          <div className="sm:text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Saldo sem eventos</p>
            <p className={`text-lg font-bold tabular-nums ${balanceWithout >= 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-600' : 'text-red-500'}`}>{fmt(balanceWithout)}</p>
            <p className="text-[11px] text-slate-400">o que sobraria só com o dia a dia</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
        {stats.map(s => (
          <div key={s.event.id} className="rounded-xl border border-slate-100 dark:border-white/[0.06] print:border-slate-200 p-4 break-inside-avoid">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.event.color }} />
              <p className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 print:text-slate-800">{s.event.name}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.event.closed
                ? 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                {s.event.closed ? 'encerrado' : 'em andamento'}
              </span>
            </div>
            <p className="text-lg font-bold tabular-nums mt-2 text-slate-800 dark:text-slate-100 print:text-slate-800">{fmt(s.total)}</p>
            <p className="text-[11px] text-slate-400">
              {s.first === s.last ? ddmm(s.first) : s.event.closed ? `${ddmm(s.first)} a ${ddmm(s.last)}` : `desde ${ddmm(s.first)}`}
              {' · '}{s.count} lançamento{s.count === 1 ? '' : 's'} · {pct(s.total, totalExpenses)} das despesas
            </p>
            <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-slate-100 dark:bg-white/[0.08]">
              {s.byCategory.map(c => <div key={c.name} title={c.name} style={{ width: `${(c.amount / s.total) * 100}%`, backgroundColor: c.color }} />)}
            </div>
            <ul className="mt-2 space-y-0.5 text-xs">
              {s.byCategory.slice(0, 4).map(c => (
                <li key={c.name} className="flex justify-between gap-2 text-slate-500 dark:text-slate-400 print:text-slate-600">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 print:text-slate-700">{fmt(c.amount)}</span>
                </li>
              ))}
              {s.byCategory.length > 4 && <li className="text-[11px] text-slate-400">+ {s.byCategory.length - 4} categorias</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-violet-50 dark:bg-violet-900/10 print:bg-violet-50 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        Eventos sem gasto neste ano não aparecem. Para criar um evento ou marcar lançamentos nele: Categorias → Eventos, ou no extrato, selecionando os lançamentos e tocando em Evento.
      </p>
    </OverviewSection>
  )
}
