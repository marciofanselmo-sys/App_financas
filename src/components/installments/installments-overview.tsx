'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CalendarClock, CreditCard, Trash2 } from 'lucide-react'
import { InstallmentItem } from '@/hooks/use-recurring'
import { TransactionBoard } from '@/types'
import { currentYearMonth } from '@/utils/local-date'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const toIndex = (ym: string) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1) }
const label = (idx: number) => `${MONTHS[idx % 12]}/${String(Math.floor(idx / 12)).slice(2)}`

const NO_CARD = '__sem_cartao__'
const NO_CARD_COLOR = '#94a3b8'
const CHART_MONTHS = 12

export interface CardGroup {
  id: string
  name: string
  color: string
  items: InstallmentItem[]
  monthly: number
  left: number
}

/**
 * Tudo o que a tela mostra sai daqui, a partir das mesmas parcelas de antes:
 * "por mês" e "falta pagar" seguem a regra antiga (só parcelamentos com
 * parcela ainda por vir); o resto é só uma forma nova de olhar para elas.
 */
export function useInstallmentsOverview(installments: InstallmentItem[], boards: TransactionBoard[]) {
  return useMemo(() => {
    const nowIdx = toIndex(currentYearMonth())
    const active = installments.filter(i => i.remaining > 0)
    const monthly = active.reduce((s, i) => s + i.monthlyAmount, 0)
    const left = active.reduce((s, i) => s + i.monthlyAmount * i.remaining, 0)

    // Cada parcela futura cai entre (fim − restantes + 1) e o fim.
    const endOf = (i: InstallmentItem) => toIndex(i.endYearMonth)
    const chargesIn = (i: InstallmentItem, idx: number) => idx > endOf(i) - i.remaining && idx <= endOf(i)

    // Grupos por cartão (conta da transação); sem conta vira "Sem cartão".
    const map = new Map<string, CardGroup>()
    for (const i of installments) {
      const board = boards.find(b => b.id === i.board_id)
      const id = board?.id ?? NO_CARD
      if (!map.has(id)) map.set(id, { id, name: board?.name.trim() ?? 'Sem cartão', color: board?.color ?? NO_CARD_COLOR, items: [], monthly: 0, left: 0 })
      const g = map.get(id)!
      g.items.push(i)
      if (i.remaining > 0) { g.monthly += i.monthlyAmount; g.left += i.monthlyAmount * i.remaining }
    }
    const groups = [...map.values()].sort((a, b) => b.monthly - a.monthly)

    // Próximos 12 meses, a partir do mês que vem, empilhado por cartão.
    const chart = Array.from({ length: CHART_MONTHS }, (_, k) => {
      const idx = nowIdx + 1 + k
      const row: Record<string, number | string> = { month: label(idx) }
      let total = 0
      for (const g of groups) {
        const v = g.items.filter(i => chargesIn(i, idx)).reduce((s, i) => s + i.monthlyAmount, 0)
        if (v > 0) { row[g.id] = v; total += v }
      }
      row.total = total
      return row
    })

    // O que deixa de sair no mês que vem: parcelamentos que acabam neste mês.
    const ending = active.filter(i => endOf(i) <= nowIdx)
    const relief = ending.reduce((s, i) => s + i.monthlyAmount, 0)
    const lastEnd = active.length ? Math.max(...active.map(endOf)) : null
    const halfIdx = chart.findIndex(r => Number(r.total) <= monthly / 2)

    return {
      monthly, left, activeCount: active.length, groups, chart,
      relief, reliefCount: ending.length, reliefLabel: label(nowIdx + 1),
      freeLabel: lastEnd != null ? label(lastEnd) : null,
      halfLabel: monthly > 0 && halfIdx >= 0 ? String(chart[halfIdx].month) : null,
    }
  }, [installments, boards])
}

type Overview = ReturnType<typeof useInstallmentsOverview>

// ── Os quatro números do topo ──────────────────────────────────────────────
export function InstallmentsSummary({ o }: { o: Overview }) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#6d28d9,#3b0764)' }}>
        <p className="text-[11px] uppercase tracking-wide text-violet-200">Parcelas / mês</p>
        <p className="font-heading text-2xl font-extrabold mt-1 tabular-nums">{fmt(o.monthly)}</p>
        <p className="text-[11px] text-violet-200 mt-0.5">{o.activeCount} parcelamento{o.activeCount === 1 ? '' : 's'} ativo{o.activeCount === 1 ? '' : 's'}</p>
      </div>
      <Kpi title="Falta pagar" value={fmt(o.left)} sub="soma das parcelas futuras" />
      <Kpi
        title={`Alivia em ${o.reliefLabel}`}
        value={o.relief > 0 ? `−${fmt(o.relief)}` : fmt(0)}
        valueClass={o.relief > 0 ? 'text-green-600 dark:text-green-400' : undefined}
        sub={o.reliefCount > 0 ? `${o.reliefCount} termina${o.reliefCount === 1 ? '' : 'm'} este mês` : 'nenhum termina este mês'}
      />
      <Kpi title="Fica livre em" value={o.freeLabel ?? '—'} sub="última parcela das compras de hoje" />
    </div>
  )
}

function Kpi({ title, value, sub, valueClass }: { title: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      <p className={cn('text-xl font-bold mt-1 tabular-nums text-slate-800 dark:text-slate-100', valueClass)}>{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function Section({ icon: Icon, title, subtitle, children, className }: {
  icon: typeof CreditCard; title: string; subtitle: string; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cn('bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5', className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">{subtitle}</p>
      {children}
    </section>
  )
}

// ── Quanto sai nos próximos meses ──────────────────────────────────────────
export function ReliefChart({ o }: { o: Overview }) {
  return (
    <Section icon={CalendarClock} title="Quanto sai em parcelas nos próximos meses" subtitle="Já comprado — mostra quando o orçamento vai aliviar">
      <div className="h-56 mt-4 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={o.chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48}
              tickFormatter={v => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1).replace('.', ',')}k` : String(v)} />
            <Tooltip
              cursor={{ fill: 'rgba(124,58,237,0.06)' }}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(v, name) => [fmt(Number(v)), o.groups.find(g => g.id === name)?.name ?? String(name)]}
            />
            {o.groups.map((g, i) => (
              <Bar key={g.id} dataKey={g.id} stackId="a" fill={g.color} isAnimationActive={false}
                radius={i === o.groups.length - 1 ? [6, 6, 0, 0] : undefined} maxBarSize={38} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500 dark:text-slate-400">
        {o.groups.map(g => (
          <span key={g.id} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />{g.name}
          </span>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
        {o.halfLabel
          ? <>Em <strong className="text-violet-700 dark:text-violet-300">{o.halfLabel}</strong> suas parcelas caem para menos da metade de hoje.</>
          : 'Suas parcelas seguem altas pelos próximos 12 meses.'}
      </p>
    </Section>
  )
}

// ── Por cartão ─────────────────────────────────────────────────────────────
export function ByCard({ o }: { o: Overview }) {
  return (
    <Section icon={CreditCard} title="Por cartão" subtitle="Parcelas por mês em cada cartão">
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
        {o.groups.map(g => {
          const pct = o.monthly > 0 ? (g.monthly / o.monthly) * 100 : 0
          return (
            <li key={g.id} className="py-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="truncate">{g.name}</span>
                </span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100 shrink-0">{fmt(g.monthly)}/mês</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.color }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {g.items.length} parcelamento{g.items.length === 1 ? '' : 's'} · falta {fmt(g.left)} · {Math.round(pct)}% do total
              </p>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

// ── Lista compacta, agrupada por cartão ────────────────────────────────────
type SortKey = 'end' | 'value' | 'left'
const SORTS: Record<SortKey, { label: string; cmp: (a: InstallmentItem, b: InstallmentItem) => number }> = {
  end: { label: 'Termina primeiro', cmp: (a, b) => a.remaining - b.remaining || a.endYearMonth.localeCompare(b.endYearMonth) },
  value: { label: 'Maior valor por mês', cmp: (a, b) => b.monthlyAmount - a.monthlyAmount },
  left: { label: 'Maior total restante', cmp: (a, b) => b.monthlyAmount * b.remaining - a.monthlyAmount * a.remaining },
}

function Badge({ remaining }: { remaining: number }) {
  if (remaining === 0) return <span className="text-[10px] font-bold text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">Última parcela</span>
  if (remaining === 1) return <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">Termina mês que vem</span>
  if (remaining >= 12) return <span className="text-[10px] font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">Longo prazo</span>
  return null
}

export function InstallmentsList({ o, onRemove }: { o: Overview; onRemove: (item: InstallmentItem) => void }) {
  const [filter, setFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('end')
  const groups = o.groups.filter(g => filter === 'all' || g.id === filter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all', name: 'Todos os cartões' }, ...o.groups].map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setFilter(g.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                filter === g.id
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:border-violet-300',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="h-8 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#111c2d] px-2 text-xs text-slate-600 dark:text-slate-300"
        >
          {(Object.keys(SORTS) as SortKey[]).map(k => <option key={k} value={k}>{SORTS[k].label}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
              <th className="text-left font-semibold px-4 py-2.5">Compra</th>
              <th className="text-left font-semibold px-3 py-2.5 hidden sm:table-cell">Progresso</th>
              <th className="text-right font-semibold px-3 py-2.5">Por mês</th>
              <th className="text-right font-semibold px-3 py-2.5 hidden md:table-cell">Falta pagar</th>
              <th className="text-right font-semibold px-3 py-2.5 hidden md:table-cell">Termina</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <GroupRows key={g.id} group={g} cmp={SORTS[sort].cmp} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRows({ group: g, cmp, onRemove }: { group: CardGroup; cmp: (a: InstallmentItem, b: InstallmentItem) => number; onRemove: (item: InstallmentItem) => void }) {
  const items = [...g.items].sort(cmp)
  return (
    <>
      <tr className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.06]">
        <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name} · {g.items.length}
          </span>
          <span className="float-right tabular-nums">{fmt(g.monthly)}/mês</span>
        </td>
      </tr>
      {items.map(item => {
        const pct = Math.round((item.currentInstallment / item.totalInstallments) * 100)
        const barColor = item.remaining === 0 ? 'bg-green-500' : item.remaining === 1 ? 'bg-amber-400' : 'bg-violet-500'
        const [y, m] = item.endYearMonth.split('-')
        return (
          <tr key={`${item.description}|${item.totalInstallments}|${item.board_id ?? ''}`} className="border-b last:border-b-0 border-slate-100 dark:border-white/[0.06] hover:bg-violet-50/40 dark:hover:bg-white/[0.02]">
            <td className="px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{item.description}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{item.category}</span>
                <Badge remaining={item.remaining} />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 sm:hidden">{item.currentInstallment}/{item.totalInstallments} parcelas</p>
            </td>
            <td className="px-3 py-2.5 hidden sm:table-cell">
              <div className="flex items-center gap-2 min-w-[140px]">
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-500 tabular-nums w-10">{item.currentInstallment}/{item.totalInstallments}</span>
              </div>
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100 whitespace-nowrap">{fmt(item.monthlyAmount)}</td>
            <td className="px-3 py-2.5 text-right hidden md:table-cell whitespace-nowrap">
              <span className="tabular-nums text-slate-700 dark:text-slate-200">{fmt(item.monthlyAmount * item.remaining)}</span>
              <p className="text-[11px] text-slate-400">{item.remaining} parcela{item.remaining === 1 ? '' : 's'}</p>
            </td>
            <td className="px-3 py-2.5 text-right hidden md:table-cell text-slate-600 dark:text-slate-300 whitespace-nowrap">{MONTHS[Number(m) - 1]}/{y.slice(2)}</td>
            <td className="pr-3 py-2.5 text-right">
              <button
                type="button"
                onClick={() => onRemove(item)}
                title="Remover da lista de parcelamentos"
                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </td>
          </tr>
        )
      })}
    </>
  )
}
