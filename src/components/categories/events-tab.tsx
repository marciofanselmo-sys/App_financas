'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  Sparkles, MoreVertical, Pencil, Trash2, Lock, Unlock, Plus, ChevronLeft, ChevronRight, CalendarDays,
  ChartPie, ReceiptText, BarChart2, ExternalLink, XCircle,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { AppEvent, Category, Transaction, TransactionBoard } from '@/types'
import { cn } from '@/lib/utils'

const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const OTHER_COLOR = '#94a3b8'
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000) + 1

type StatusFilter = 'all' | 'open' | 'closed'

interface EventSummary {
  event: AppEvent
  txs: Transaction[]
  spent: number
  back: number
  net: number
  first: string | null
  last: string | null
  cats: { name: string; value: number; color: string }[]
}

/**
 * Aba Eventos da tela de Categorias. Tudo sai dos lançamentos com event_id:
 * gasto (saídas), o que voltou (entradas: estorno, reembolso), custo final,
 * categorias, dia a dia. "Por mês" recorta tudo para um mês só.
 */
export function EventsTab({
  events, loading, transactions, categories, boards,
  onNew, onEdit, onDelete, onToggleClosed, onRemoveFromEvent,
}: {
  events: AppEvent[]
  loading: boolean
  transactions: Transaction[]
  categories: Category[]
  boards: TransactionBoard[]
  onNew: () => void
  onEdit: (ev: AppEvent) => void
  onDelete: (ev: AppEvent) => void
  onToggleClosed: (ev: AppEvent) => void
  onRemoveFromEvent: (tx: Transaction) => Promise<void>
}) {
  const now = new Date()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [byMonth, setByMonth] = useState(false)
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`
  const monthLabel = `${MONTHS[ym.m]}/${ym.y}`
  const shiftMonth = (d: number) => setYm(p => {
    const t = new Date(p.y, p.m + d, 1)
    return { y: t.getFullYear(), m: t.getMonth() }
  })

  // Cor da categoria (a da mãe, se for subcategoria) e o nome da mãe.
  const catInfo = useMemo(() => {
    const byName = new Map<string, Category>()
    for (const c of categories) if (!byName.has(c.name)) byName.set(c.name, c)
    return (name: string) => {
      const c = byName.get(name)
      const mother = c?.parent_id ? categories.find(m => m.id === c.parent_id) ?? c : c
      return { mother: mother?.name ?? name, color: mother?.color ?? OTHER_COLOR }
    }
  }, [categories])
  const boardName = (id: string | null | undefined) => boards.find(b => b.id === id)?.name.trim() ?? 'Sem conta'

  function summarize(ev: AppEvent, onlyMonth: boolean): EventSummary {
    const txs = transactions
      .filter(t => t.event_id === ev.id && (!onlyMonth || t.date.slice(0, 7) === monthKey))
      .sort((a, b) => b.date.localeCompare(a.date))
    let spent = 0, back = 0
    const cats = new Map<string, { name: string; value: number; color: string }>()
    for (const t of txs) {
      const v = Number(t.amount)
      if (t.type === 'despesa') {
        spent += v
        const info = catInfo(t.category || 'Outros')
        const c = cats.get(info.mother) ?? { name: info.mother, value: 0, color: info.color }
        c.value += v
        cats.set(info.mother, c)
      } else {
        back += v
      }
    }
    return {
      event: ev, txs, spent, back, net: spent - back,
      first: txs.length ? txs[txs.length - 1].date : null,
      last: txs.length ? txs[0].date : null,
      cats: [...cats.values()].sort((a, b) => b.value - a.value),
    }
  }

  const all = useMemo(
    () => events.map(ev => ({ total: summarize(ev, false), month: summarize(ev, true) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, transactions, monthKey, catInfo],
  )
  const counts = {
    all: events.length,
    open: events.filter(e => !e.closed).length,
    closed: events.filter(e => e.closed).length,
  }
  const listed = all.filter(x => status === 'all' || (status === 'open' ? !x.total.event.closed : x.total.event.closed))
  const active = byMonth ? listed.filter(x => x.month.txs.length > 0) : listed
  const idle = byMonth ? listed.filter(x => x.month.txs.length === 0) : []
  const selected = active.find(x => x.total.event.id === selectedId) ?? active[0] ?? null
  const view = selected ? (byMonth ? selected.month : selected.total) : null
  const monthTotal = active.reduce((s, x) => s + x.month.net, 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />)}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" className="gap-2" onClick={onNew}><Plus className="h-4 w-4" /> Novo evento</Button>
        </div>
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-slate-600 dark:text-slate-300">Nenhum evento ainda</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Crie um quando for fazer uma viagem, uma reforma ou um campeonato</p>
        </div>
      </div>
    )
  }

  const chip = (on: boolean) => cn(
    'rounded-full border px-3 py-1 text-xs transition-colors',
    on ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:border-blue-300',
  )

  return (
    <div className="space-y-4">
      {/* Filtros: status, período e novo evento */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(status === 'all')} onClick={() => setStatus('all')}>Todos · {counts.all}</button>
          <button type="button" className={chip(status === 'open')} onClick={() => setStatus('open')}>Em andamento · {counts.open}</button>
          <button type="button" className={chip(status === 'closed')} onClick={() => setStatus('closed')}>Encerrados · {counts.closed}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([[false, 'Todo o período'], [true, 'Por mês']] as const).map(([v, l]) => (
              <button key={l} type="button" onClick={() => { setByMonth(v); setShowAll(false) }}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  byMonth === v ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400')}>
                {l}
              </button>
            ))}
          </div>
          {byMonth && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-1 py-0.5">
              <button type="button" onClick={() => shiftMonth(-1)} className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-700" aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize min-w-[120px] text-center">{MONTHS[ym.m]} {ym.y}</span>
              <button type="button" onClick={() => shiftMonth(1)} className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-700" aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
          <Button size="sm" className="gap-2" onClick={onNew}><Plus className="h-4 w-4" /> Novo evento</Button>
        </div>
      </div>

      {/* Por mês: quanto cada evento gastou no mês */}
      {byMonth && (
        <OverviewSection icon={CalendarDays} title={`Gasto dos eventos em ${monthLabel}`} subtitle="Quanto do mês foi para eventos — fora do dia a dia normal">
          {active.length === 0 ? (
            <p className="text-sm text-slate-400 mt-3">Nenhum evento com lançamento neste mês.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {active.map(x => {
                  const max = Math.max(...active.map(a => a.month.net), 0.01)
                  return (
                    <li key={x.month.event.id} className="flex items-center gap-3 text-xs">
                      <span className="w-40 truncate text-slate-600 dark:text-slate-300">{x.month.event.name}</span>
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(0, x.month.net) / max * 100}%`, backgroundColor: x.month.event.color }} />
                      </div>
                      <span className="w-24 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{money(x.month.net)}</span>
                      <span className="w-9 text-right tabular-nums text-slate-400">{monthTotal > 0 ? Math.round(x.month.net / monthTotal * 100) : 0}%</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex justify-between text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total em eventos</span>
                <span className="font-bold tabular-nums text-red-500">{money(monthTotal)}</span>
              </div>
            </>
          )}
        </OverviewSection>
      )}

      {/* Cartões de evento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map(x => {
          const s = x.total
          const ev = s.event
          const isSel = selected?.total.event.id === ev.id
          const days = s.first && s.last ? daysBetween(s.first, s.last) : 0
          const catTotal = s.cats.reduce((a, c) => a + c.value, 0)
          return (
            <div
              key={ev.id}
              role="button"
              tabIndex={0}
              onClick={() => { setSelectedId(ev.id); setShowAll(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { setSelectedId(ev.id); setShowAll(false) } }}
              className={cn(
                'bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border p-4 cursor-pointer transition-all',
                isSel ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-500/20' : 'border-slate-100 dark:border-white/[0.06] hover:border-blue-200',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ev.color}1f`, color: ev.color }}>
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{ev.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {s.first ? `${dm(s.first)} a ${dm(s.last!)} · ${days} dia${days === 1 ? '' : 's'} · ` : ''}{s.txs.length} lançamento{s.txs.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0',
                  ev.closed ? 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
                  {ev.closed ? 'Encerrado' : 'Em andamento'}
                </span>
                <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06]" aria-label={`Ações de ${ev.name}`}>
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onEdit(ev)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleClosed(ev)}>
                        {ev.closed ? <><Unlock className="h-4 w-4 mr-2" /> Reabrir</> : <><Lock className="h-4 w-4 mr-2" /> Encerrar</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(ev)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {byMonth && (
                <p className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1.5 text-xs text-blue-700 dark:text-blue-300">
                  Em {monthLabel}: <strong className="tabular-nums">{money(x.month.net)}</strong> · {x.month.txs.length} lançamento{x.month.txs.length === 1 ? '' : 's'}
                </p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{byMonth ? 'Gasto total' : 'Gasto'}</p>
                  <p className="text-sm font-bold tabular-nums text-red-500">{money(s.spent)}</p>
                </div>
                {s.back > 0.005 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Voltou</p>
                    <p className="text-sm font-bold tabular-nums text-green-600 dark:text-green-400">+{money(s.back)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Custo final</p>
                  <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{money(s.net)}</p>
                </div>
              </div>

              {catTotal > 0 && (
                <>
                  <div className="flex h-2 rounded-full overflow-hidden mt-3 bg-slate-100 dark:bg-white/[0.08]">
                    {s.cats.map(c => <div key={c.name} title={c.name} style={{ width: `${c.value / catTotal * 100}%`, backgroundColor: c.color }} />)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {s.cats.slice(0, 3).map(c => (
                      <span key={c.name} className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name} {Math.round(c.value / catTotal * 100)}%
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {idle.map(x => (
          <div key={x.total.event.id} className="rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.1] p-4 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{x.total.event.name}</p>
            <p className="text-[11px] text-slate-400">sem gasto em {monthLabel}{x.total.event.closed ? ' · encerrado' : ''}</p>
          </div>
        ))}
      </div>

      {listed.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-6">Nenhum evento neste filtro.</p>
      )}

      {/* Detalhe do evento escolhido */}
      {selected && view && (
        <EventDetail
          s={view}
          monthLabel={byMonth ? monthLabel : null}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          boardName={boardName}
          catColor={name => catInfo(name || 'Outros').color}
          removing={removing}
          onRemove={async tx => { setRemoving(tx.id); await onRemoveFromEvent(tx); setRemoving(null) }}
        />
      )}

      {/* Comparar eventos */}
      {active.length > 1 && (
        <OverviewSection icon={BarChart2} title="Comparar eventos" subtitle={byMonth ? `Custo de cada evento em ${monthLabel}` : 'Custo final de cada evento'}>
          <ul className="mt-3 space-y-2">
            {(() => {
              const rows = active.map(x => (byMonth ? x.month : x.total)).sort((a, b) => b.net - a.net)
              const max = Math.max(...rows.map(r => r.net), 0.01)
              return rows.map(r => (
                <li key={r.event.id} className="flex items-center gap-3 text-xs">
                  <span className="w-40 truncate text-slate-600 dark:text-slate-300">{r.event.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, r.net) / max * 100}%`, backgroundColor: r.event.color }} />
                  </div>
                  <span className="w-24 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{money(r.net)}</span>
                </li>
              ))
            })()}
          </ul>
        </OverviewSection>
      )}
    </div>
  )
}

function EventDetail({ s, monthLabel, showAll, onShowAll, boardName, catColor, removing, onRemove }: {
  s: EventSummary
  monthLabel: string | null
  showAll: boolean
  onShowAll: () => void
  boardName: (id: string | null | undefined) => string
  catColor: (name: string) => string
  removing: string | null
  onRemove: (tx: Transaction) => Promise<void>
}) {
  const router = useRouter()
  const ev = s.event
  const days = s.first && s.last ? daysBetween(s.first, s.last) : 0
  // Dia a dia até ~4 meses, com TODOS os dias do período (inclusive os sem
  // gasto, para dar a noção de tempo); acima disso, mês a mês.
  const byDay = days <= 120
  const series = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of s.txs) {
      if (t.type !== 'despesa') continue
      const k = byDay ? t.date : t.date.slice(0, 7)
      map.set(k, (map.get(k) ?? 0) + Number(t.amount))
    }
    if (byDay && s.first && s.last) {
      const out: { label: string; value: number }[] = []
      const d = new Date(Date.UTC(+s.first.slice(0, 4), +s.first.slice(5, 7) - 1, +s.first.slice(8, 10)))
      const end = s.last
      for (let i = 0; i < 400; i++) {
        const iso = d.toISOString().slice(0, 10)
        if (iso > end) break
        out.push({ label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, value: map.get(iso) ?? 0 })
        d.setUTCDate(d.getUTCDate() + 1)
      }
      return out
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ label: `${SHORT[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`, value: v }))
  }, [s.txs, s.first, s.last, byDay])
  // Muitos dias: o gráfico fica mais largo que o card e rola para o lado.
  const chartMinWidth = byDay ? Math.max(0, series.length * 22) : 0
  const txs = showAll ? s.txs : s.txs.slice(0, 8)
  const catTotal = s.cats.reduce((a, c) => a + c.value, 0)

  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${ev.color}1f`, color: ev.color }}>
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{ev.name}</h2>
          <p className="text-xs text-slate-400">
            {s.first ? `${dm(s.first)} a ${dm(s.last!)}` : 'Sem lançamentos'} · {ev.closed ? 'encerrado' : 'em andamento'}
            {monthLabel && ` · mostrando ${monthLabel}`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { l: 'Gasto', v: money(s.spent), cls: 'text-red-500', sub: `${s.txs.length} lançamento${s.txs.length === 1 ? '' : 's'}` },
          { l: 'Voltou', v: `+${money(s.back)}`, cls: 'text-green-600 dark:text-green-400', sub: 'estornos e reembolsos' },
          { l: 'Custo final', v: money(s.net), cls: 'text-slate-800 dark:text-slate-100', sub: 'gasto − o que voltou' },
          { l: 'Por dia', v: days > 0 ? money(s.net / days) : '—', cls: 'text-slate-800 dark:text-slate-100', sub: days > 0 ? `em ${days} dia${days === 1 ? '' : 's'}` : '' },
        ].map(k => (
          <div key={k.l} className="rounded-xl border border-slate-100 dark:border-white/[0.06] px-3 py-2.5">
            <p className="text-[10.5px] uppercase tracking-wide text-slate-400">{k.l}</p>
            <p className={cn('text-base font-extrabold tabular-nums mt-0.5', k.cls)}>{k.v}</p>
            <p className="text-[10.5px] text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

        <OverviewSection icon={CalendarDays} title={byDay ? 'Dia a dia' : 'Mês a mês'} subtitle={byDay ? `Quanto saiu em cada um dos ${series.length} dias do período` : 'Quanto saiu em cada mês do evento'}>
          {series.length > 0 ? (
            <div className="mt-4 -ml-2 overflow-x-auto">
              <div className="h-56" style={{ minWidth: chartMinWidth }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44}
                    tickFormatter={v => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1).replace('.', ',')}k` : String(v)} />
                  <Tooltip cursor={{ fill: 'rgba(37,99,235,0.06)' }} contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={v => [money(Number(v)), 'Gasto']} />
                  <Bar dataKey="value" fill={ev.color} radius={[5, 5, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 mt-4">Nenhum gasto {monthLabel ? 'neste mês' : 'ainda'}.</p>}
        </OverviewSection>

        <OverviewSection icon={ChartPie} title="Por categoria" subtitle="O lançamento continua na categoria — aqui você vê o peso de cada uma no evento">
          {catTotal > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-5 mt-4">
              <div className="relative h-40 w-40 shrink-0 [&_path]:stroke-white dark:[&_path]:stroke-[#111c2d]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.cats} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
                      {s.cats.map(c => <Cell key={c.name} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={v => money(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-sm font-extrabold tabular-nums text-[#0B2D6B] dark:text-slate-100">{money(s.spent)}</span>
                  <span className="text-[10px] text-slate-400">gasto</span>
                </div>
              </div>
              <ul className="flex-1 min-w-0 w-full space-y-1.5">
                {s.cats.map(c => (
                  <li key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">{c.name}</span>
                    <span className="tabular-nums text-slate-400">{Math.round(c.value / catTotal * 100)}%</span>
                    <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 w-24 text-right">{money(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-xs text-slate-400 mt-4">Nenhum gasto {monthLabel ? 'neste mês' : 'ainda'}.</p>}
        </OverviewSection>


      <OverviewSection icon={ReceiptText} title="Lançamentos" subtitle="De todas as contas · para trocar a categoria, abra na conta">
        {s.txs.length === 0 ? (
          <p className="text-xs text-slate-400 mt-3">Nenhum lançamento {monthLabel ? 'neste mês' : 'neste evento'}.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
              {txs.map(t => {
                const isIn = t.type !== 'despesa'
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-11 text-[11px] text-slate-400 tabular-nums shrink-0">{dm(t.date)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-slate-700 dark:text-slate-200 truncate">{t.description}</p>
                      <p className="text-[11px] text-slate-400 truncate">{boardName(t.board_id)}</p>
                    </div>
                    {t.category && (
                      <span className="hidden sm:inline text-[10.5px] font-medium rounded-full px-2 py-0.5 text-white shrink-0" style={{ backgroundColor: catColor(t.category) }}>
                        {t.category}
                      </span>
                    )}
                    <span className={cn('w-24 text-right text-[13px] font-semibold tabular-nums shrink-0', isIn ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200')}>
                      {isIn ? '+' : ''}{money(Number(t.amount))}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger disabled={removing === t.id} className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0" aria-label="Ações do lançamento">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {t.board_id && (
                          <DropdownMenuItem onClick={() => router.push(`/transactions/${t.board_id}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Abrir na conta
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onRemove(t)}>
                          <XCircle className="h-4 w-4 mr-2" /> Tirar do evento
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
            {!showAll && s.txs.length > txs.length && (
              <button type="button" onClick={onShowAll} className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                Ver os {s.txs.length} lançamentos →
              </button>
            )}
          </>
        )}
      </OverviewSection>
    </section>
  )
}
