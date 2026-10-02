'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import {
  ChartBar, CalendarDays, ChevronRight, RotateCcw, CreditCard, ArrowRight, SearchX,
  Info, CheckCircle2, EyeOff, ListChecks, Tag, Eye, type LucideIcon,
} from 'lucide-react'
import { DisplayItem } from '@/lib/recurring-groups'
import { InstallmentItem } from '@/hooks/use-recurring'
import { Kpi, OverviewSection } from '@/components/ui/overview-blocks'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const pct = (v: number) => `${Math.round(v)}%`
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dayOf = (iso: string) => Number(iso.slice(8, 10))
export const PARCELAS_COLOR = '#8b5cf6'
const FREE_COLOR = '#2563eb'

export interface CategoryGroup {
  name: string
  color: string
  items: DisplayItem[]
  total: number
}

/**
 * Um fixo confirmado "sumiu" quando não apareceu nem no mês passado nem neste
 * — assinatura cancelada, conta que mudou de nome. Só aviso: nada muda sozinho.
 */
export function missingSince(item: DisplayItem, today: Date): string | null {
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevYM = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  return item.lastDate.slice(0, 7) < prevYM ? MONTHS[prev.getMonth()] : null
}

// ── Os quatro números do topo ──────────────────────────────────────────────
export function RecurringSummary({ despesa, receita, despesaCount, receitaCount }: {
  despesa: number; receita: number; despesaCount: number; receitaCount: number
}) {
  const free = receita - despesa
  const used = receita > 0 ? (despesa / receita) * 100 : null
  const gaugeColor = used == null ? '' : used > 70 ? 'bg-red-500' : used > 50 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#1d4ed8,#0B2D6B)' }}>
        <p className="text-[11px] uppercase tracking-wide text-blue-100">Sobra livre / mês</p>
        <p className="font-heading text-2xl font-extrabold mt-1 tabular-nums">{receita > 0 ? fmt(free) : '—'}</p>
        <p className="text-[11px] text-blue-100 mt-0.5">{receita > 0 ? 'receita fixa − despesa fixa' : 'confirme uma receita fixa para ver'}</p>
      </div>
      <Kpi title="Renda comprometida" value={used != null ? pct(used) : '—'} sub="da receita fixa já tem destino">
        <div className="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full mt-2 mb-1 overflow-hidden">
          {used != null && <div className={cn('h-full rounded-full', gaugeColor)} style={{ width: `${Math.min(100, used)}%` }} />}
        </div>
      </Kpi>
      <Kpi title="Despesa fixa / mês" value={fmt(despesa)} valueClass="text-red-500 dark:text-red-400"
        sub={`${despesaCount} fixo${despesaCount === 1 ? '' : 's'} · inclui parcelas`} />
      <Kpi title="Receita fixa / mês" value={fmt(receita)} valueClass="text-green-600 dark:text-green-400"
        sub={`${receitaCount} fonte${receitaCount === 1 ? '' : 's'}`} />
    </div>
  )
}

// ── Para onde vai sua receita fixa ─────────────────────────────────────────
export function IncomeSplit({ groups, despesa, receita }: { groups: CategoryGroup[]; despesa: number; receita: number }) {
  const base = Math.max(receita, despesa)
  const parts = [...groups.map(g => ({ name: g.name, color: g.color, value: g.total }))]
  if (receita > despesa) parts.push({ name: 'Sobra livre', color: FREE_COLOR, value: receita - despesa })
  return (
    <OverviewSection icon={ChartBar} title="Para onde vai sua receita fixa"
      subtitle={receita > 0 ? 'Cada fixo como parte da sua renda fixa do mês — o que sobra é seu' : 'Sem receita fixa confirmada: mostra o peso de cada despesa fixa'}>
      {base > 0 ? (
        <>
          <div className="flex h-5 rounded-lg overflow-hidden mt-4 bg-slate-100 dark:bg-white/[0.08]">
            {parts.map(p => <div key={p.name} title={`${p.name}: ${fmt(p.value)}`} style={{ width: `${(p.value / base) * 100}%`, backgroundColor: p.color }} />)}
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs">
            {parts.map(p => (
              <li key={p.name} className="flex items-center justify-between gap-2 min-w-0">
                <span className="inline-flex items-center gap-2 min-w-0 text-slate-500 dark:text-slate-400">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                  {pct((p.value / base) * 100)} · {fmt(p.value)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-slate-400 mt-4">Confirme seus fixos para ver a divisão.</p>
      )}
    </OverviewSection>
  )
}

// ── Quando cai no mês ──────────────────────────────────────────────────────
const WEEKS: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, 31]]

export function MonthCalendar({ despesas, receitas, installments }: {
  despesas: DisplayItem[]; receitas: DisplayItem[]; installments: InstallmentItem[]
}) {
  // Parcelas caem no dia da fatura de cada cartão — sem esse dado, ficam fora
  // do calendário (aparecem no total do mês, não numa semana).
  const all = [
    ...despesas.map(i => ({ key: i.key, name: i.name, value: i.avgAmount, day: dayOf(i.lastDate), out: true })),
    ...receitas.map(i => ({ key: i.key, name: i.name, value: i.avgAmount, day: dayOf(i.lastDate), out: false })),
  ]
  const weeks = WEEKS.map(([a, b]) => {
    const list = all.filter(i => i.day >= a && i.day <= b).sort((x, y) => y.value - x.value)
    return { a, b, list, out: list.filter(i => i.out).reduce((s, i) => s + i.value, 0) }
  })
  const heavy = weeks.reduce((m, w) => (w.out > m.out ? w : m), weeks[0])
  return (
    <OverviewSection icon={CalendarDays} title="Quando cai no mês" subtitle="Pelo dia em que cada fixo costuma cair">
      <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
        {weeks.map(w => (
          <li key={w.a} className={cn('flex items-start gap-3 py-2.5', w === heavy && w.out > 0 && 'bg-red-50/70 dark:bg-red-500/10 -mx-2 px-2 rounded-lg')}>
            <span className="w-16 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-0.5">dia {w.a}–{w.b}</span>
            <span className="flex flex-wrap gap-1 min-w-0 flex-1">
              {w.list.length === 0 && <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>}
              {w.list.map(i => (
                <span key={i.key} className={cn('text-[11px] px-2 py-0.5 rounded-full truncate max-w-[160px]',
                  i.out ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400')}>
                  {i.name}
                </span>
              ))}
            </span>
            <span className="text-xs font-bold tabular-nums text-red-500 shrink-0 pt-0.5">{w.out > 0 ? `−${fmt(w.out)}` : ''}</span>
          </li>
        ))}
      </ul>
      {heavy.out > 0 && (
        <p className="text-[11px] text-slate-400 mt-2">
          Semana mais pesada: <strong className="text-red-500">dia {heavy.a} a {heavy.b}</strong>. Em verde, as entradas.
          {installments.length > 0 && ' Parcelas caem na fatura de cada cartão e não entram aqui.'}
        </p>
      )}
    </OverviewSection>
  )
}

// ── Fixo que sumiu ─────────────────────────────────────────────────────────
export function MissingAlert({ items, today }: { items: DisplayItem[]; today: Date }) {
  const gone = items.map(i => ({ item: i, month: missingSince(i, today) })).filter(x => x.month)
  if (gone.length === 0) return null
  const month = gone[0].month
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/50 border-l-4 border-l-red-500 bg-white dark:bg-[#111c2d] px-4 py-3 text-sm">
      <SearchX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          {gone.length} fixo{gone.length === 1 ? '' : 's'} não aparece{gone.length === 1 ? 'u' : 'ram'} em {month}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            {' '}— {gone.map(g => `${g.item.name} (último em ${MONTHS[Number(g.item.lastDate.slice(5, 7)) - 1]})`).join(', ')}.
          </span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Se foram cancelados, desfaça a confirmação (↺) e eles saem do total.</p>
      </div>
    </div>
  )
}

// ── Tabela por categoria (Despesas fixas / Receitas fixas) ─────────────────
export function FixedTable({ groups, total, totalClass, installments, today, onUndo }: {
  groups: CategoryGroup[]
  total: number
  totalClass: string
  /** Só em Despesas: Cartões & Parcelas, sempre conta como fixo. */
  installments?: InstallmentItem[]
  today: Date
  onUndo: (item: DisplayItem) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setOpen(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })
  // Mesmo critério do total da página (todas as parcelas listadas).
  const parcelasTotal = (installments ?? []).reduce((s, i) => s + i.monthlyAmount, 0)
  const rows = [
    ...groups.map(g => ({ kind: 'cat' as const, key: g.name, g, value: g.total })),
    ...(installments && installments.length > 0 ? [{ kind: 'parcelas' as const, key: '__parcelas__', g: null, value: parcelasTotal }] : []),
  ].sort((a, b) => b.value - a.value)

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
            <th className="text-left font-semibold px-4 py-2.5">Categoria</th>
            <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Cai no dia</th>
            <th className="text-left font-semibold px-3 py-2.5 hidden md:table-cell">Frequência</th>
            <th className="text-right font-semibold px-3 py-2.5">Por mês</th>
            <th className="text-right font-semibold px-3 py-2.5 hidden sm:table-cell">Peso</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isOpen = open.has(r.key)
            const share = total > 0 ? (r.value / total) * 100 : 0
            const color = r.kind === 'parcelas' ? PARCELAS_COLOR : r.g!.color
            const days = r.kind === 'cat' ? [...new Set(r.g!.items.map(i => dayOf(i.lastDate)))].sort((a, b) => a - b) : []
            const hasMissing = r.kind === 'cat' && r.g!.items.some(i => missingSince(i, today))
            return (
              <Fragment key={r.key}>
                <tr onClick={() => toggle(r.key)} className="cursor-pointer border-b border-slate-100 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                      <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '22' }}>
                        {r.kind === 'parcelas' ? <CreditCard className="h-3.5 w-3.5" style={{ color }} /> : <Tag className="h-3.5 w-3.5" style={{ color }} />}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{r.kind === 'parcelas' ? 'Cartões & Parcelas' : r.g!.name}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        · {r.kind === 'parcelas' ? 'sempre conta' : `${r.g!.items.length} fixo${r.g!.items.length === 1 ? '' : 's'}`}
                      </span>
                      {hasMissing && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Tem fixo que não apareceu no último mês" />}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-xs text-slate-400">
                    {r.kind === 'parcelas' ? 'na fatura' : days.length > 2 ? `${days.length} datas` : days.map(d => `dia ${d}`).join(', ')}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell" />
                  <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap', totalClass)}>{fmt(r.value)}</td>
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums w-8 text-right">{pct(share)}</span>
                    </div>
                  </td>
                  <td />
                </tr>
                {isOpen && r.kind === 'cat' && [...r.g!.items].sort((a, b) => b.avgAmount - a.avgAmount).map(item => (
                  <ItemRow key={item.key} item={item} today={today} onUndo={() => onUndo(item)} />
                ))}
                {isOpen && r.kind === 'parcelas' && (
                  <>
                    {(installments ?? []).map(i => (
                      <tr key={`${i.description}|${i.totalInstallments}|${i.board_id ?? ''}`} className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                        <td className="pl-14 pr-3 py-2 text-[13px] text-slate-700 dark:text-slate-200">{i.description}</td>
                        <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-400">na fatura</td>
                        <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-400">parcela {i.currentInstallment}/{i.totalInstallments}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[13px] font-semibold text-slate-700 dark:text-slate-200">{fmt(i.monthlyAmount)}</td>
                        <td className="hidden sm:table-cell" /><td />
                      </tr>
                    ))}
                    <tr className="bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
                      <td colSpan={6} className="pl-14 py-2">
                        <Link href="/recurring" className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                          Ver em Cartões & Parcelas <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  </>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ItemRow({ item, today, onUndo }: { item: DisplayItem; today: Date; onUndo: () => void }) {
  const [open, setOpen] = useState(false)
  const gone = missingSince(item, today)
  return (
    <>
      <tr className="group bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
        <td className="pl-14 pr-3 py-2">
          <button type="button" disabled={!item.isGroup} onClick={() => setOpen(v => !v)} className="text-left disabled:cursor-default min-w-0">
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-700 dark:text-slate-200">
              {item.name}
              {item.isGroup && (
                <span className="text-[11px] text-slate-400 inline-flex items-center">
                  {item.descriptions.length} descriç{item.descriptions.length === 1 ? 'ão' : 'ões'}
                  <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
                </span>
              )}
              {gone && <span className="text-[10px] font-bold text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">Não veio em {gone}</span>}
            </span>
          </button>
        </td>
        <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-400">todo dia {dayOf(item.lastDate)}</td>
        <td className="px-3 py-2 hidden md:table-cell text-xs text-slate-400">{item.monthsCount} de 12 meses</td>
        <td className="px-3 py-2 text-right tabular-nums text-[13px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{fmt(item.avgAmount)}</td>
        <td className="hidden sm:table-cell" />
        <td className="pr-3 py-2 text-right">
          <button
            type="button"
            onClick={onUndo}
            title="Desfazer confirmação"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
      {open && item.descriptions.map(d => (
        <tr key={d} className="bg-slate-50/70 dark:bg-white/[0.02]">
          <td colSpan={6} className="pl-20 pr-3 py-1 text-xs text-slate-400 truncate">• {d}</td>
        </tr>
      ))}
    </>
  )
}

// ── Como funciona esta tela ────────────────────────────────────────────────
function HelpItem({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
        <Icon className={cn('h-3.5 w-3.5 text-slate-400', iconClass)} />
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <strong className="text-slate-700 dark:text-slate-200">{title}</strong>{' '}{children}
      </p>
    </div>
  )
}

/** Explicação da tela Recorrências — no fim da página, recolhida (mesmo padrão das outras telas). */
export function RecurringHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os números</p>
            <HelpItem icon={ChartBar} iconClass="text-blue-600" title="Sobra livre e renda comprometida.">
              Receita fixa menos despesa fixa, e quanto da receita fixa já tem destino antes de o mês começar.
            </HelpItem>
            <HelpItem icon={Tag} title="Despesa fixa / mês.">
              Soma dos fixos de despesa confirmados mais as parcelas de Cartões &amp; Parcelas. É o valor que vai para
              &ldquo;Gastos Previstos&rdquo; no Planejamento. Receita fixa não entra em nenhum total de gasto.
            </HelpItem>
            <HelpItem icon={CalendarDays} title="Quando cai no mês.">
              Usa o dia da última cobrança de cada fixo e agrupa por semana. Parcelas caem na fatura de cada cartão e
              ficam fora do calendário.
            </HelpItem>
            <HelpItem icon={SearchX} iconClass="text-red-500" title="Fixo que sumiu.">
              Um fixo confirmado que não apareceu no mês passado ganha o aviso &ldquo;Não veio em…&rdquo;. Nada muda
              sozinho: se foi cancelado, desfaça a confirmação.
            </HelpItem>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O que dá para fazer</p>
            <HelpItem icon={ListChecks} iconClass="text-amber-500" title="Para revisar.">
              O app encontra sozinho o que se repete em 2 ou mais meses seguidos. <strong>Confirmar</strong> marca todas
              as transações com essa descrição como recorrentes, e as próximas importações já chegam marcadas.
            </HelpItem>
            <HelpItem icon={EyeOff} title="Ignorar.">
              Tira da lista de pendentes, sem apagar nada. Dá para restaurar em &ldquo;Ver ignorados&rdquo;.
            </HelpItem>
            <HelpItem icon={CheckCircle2} iconClass="text-green-600" title="Categorias e subcategorias.">
              O que já é fixo aparece por categoria. Abra uma para ver os itens; numa subcategoria, clique para ver as
              descrições do extrato que entram nela.
            </HelpItem>
            <HelpItem icon={RotateCcw} title="Desfazer.">
              O ↺ na linha do item volta ele para &ldquo;Para revisar&rdquo; e tira do total.
            </HelpItem>
            <HelpItem icon={Eye} title="Cartões & Parcelas.">
              Parcelamentos ativos entram em Despesas sem precisar confirmar — já são cobranças garantidas.
            </HelpItem>
          </div>
        </div>
      )}
    </section>
  )
}
