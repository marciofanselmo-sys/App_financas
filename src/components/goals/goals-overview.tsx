'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, Info, Link2, MoreVertical, Pencil, RefreshCw, Trash2, Trophy, Flame, CalendarClock, BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { Goal } from '@/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

/** Números de uma meta — calculados na página (mesmas fórmulas de antes). */
export interface GoalView {
  goal: Goal
  pct: number
  /** Meses até o prazo. */
  months: number
  remaining: number
  /** Necessário por mês = falta ÷ meses até o prazo. */
  monthly: number
  /** Ritmo = já guardado ÷ meses desde o início da meta. */
  currentPace: number
  monthsElapsed: number
  /** Mês/ano em que chega no ritmo atual (falta ÷ ritmo). */
  projectedDate: string | null
  deadlineLabel: string
  typeLabel: string
  TypeIcon: React.ElementType
  status: { label: string; color: string; Icon: React.ElementType } | null
  /** Ligada a uma conta de investimento que ainda não tem valor. */
  awaitingBoard: boolean
}

const active = (v: GoalView) => v.pct < 100

// ── Resumo do topo (3 números) ─────────────────────────────────────────────
export function GoalsSummary({ items }: { items: GoalView[] }) {
  const saved = items.reduce((s, v) => s + v.goal.currentAmount, 0)
  const target = items.reduce((s, v) => s + v.goal.targetAmount, 0)
  const savedPct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0
  const open = items.filter(active)
  const needed = open.filter(v => v.months > 0).reduce((s, v) => s + v.monthly, 0)
  const pace = open.reduce((s, v) => s + v.currentPace, 0)
  const pacePct = needed > 0 ? Math.round((pace / needed) * 100) : null
  const paceOk = pacePct == null || pacePct >= 100

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#1d4ed8,#0B2D6B)' }}>
        <p className="text-[11px] uppercase tracking-wide text-blue-100">Já guardado</p>
        <p className="font-heading text-2xl font-extrabold mt-1 tabular-nums">{fmt(saved)}</p>
        <div className="h-1.5 rounded-full bg-white/20 mt-2 overflow-hidden"><div className="h-full rounded-full bg-white" style={{ width: `${savedPct}%` }} /></div>
        <p className="text-[11px] text-blue-100 mt-1.5">{savedPct}% de {fmt(target)} somando todas as metas</p>
      </div>
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Guardar por mês</p>
        <p className="text-xl font-bold mt-1 tabular-nums text-slate-800 dark:text-slate-100">{fmt(needed)}</p>
        <p className="text-[11px] text-slate-400 mt-1">o necessário para cumprir todos os prazos</p>
      </div>
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Seu ritmo atual</p>
        <p className={cn('text-xl font-bold mt-1 tabular-nums', paceOk ? 'text-emerald-600' : 'text-amber-500')}>{fmt(pace)}<span className="text-sm font-medium text-slate-400">/mês</span></p>
        {pacePct != null && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] mt-2 overflow-hidden">
            <div className={cn('h-full rounded-full', paceOk ? 'bg-emerald-500' : 'bg-amber-500')} style={{ width: `${Math.min(100, pacePct)}%` }} />
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1.5">
          {pacePct == null ? 'quanto você vem guardando por mês'
            : paceOk ? `${pacePct}% do necessário — dá conta dos prazos`
              : `${pacePct}% do necessário · faltam ${fmt(needed - pace)}/mês`}
        </p>
      </div>
    </div>
  )
}

// ── Card compacto de uma meta ──────────────────────────────────────────────
export function GoalCard({ v, onEdit, onDelete, onRefresh, onPickBoard, canLink }: {
  v: GoalView
  onEdit: () => void
  onDelete: () => void
  onRefresh?: () => void
  onPickBoard?: () => void
  canLink: boolean
}) {
  const { goal } = v
  const imp = goal.lastImport
  const linked = imp?.source === 'board'
  const Icon = v.pct >= 100 ? Trophy : v.TypeIcon
  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: goal.color + '20' }}>
          <Icon className="h-4 w-4" style={{ color: goal.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={goal.name}>{goal.name}</p>
            {v.status && (
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700', v.status.color)}>
                <v.status.Icon className="h-2.5 w-2.5" /> {v.status.label}
              </span>
            )}
            {v.pct >= 100 && <span className="text-[10px] font-semibold text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">Concluída</span>}
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {linked
              ? <span className="text-violet-500 dark:text-violet-400 font-medium"><Link2 className="inline h-3 w-3 -mt-0.5" /> {imp?.boardName}</span>
              : v.typeLabel}
            {' · '}prazo {v.deadlineLabel}{v.months > 0 && ` (${v.months} ${v.months === 1 ? 'mês' : 'meses'})`}
          </p>
          {v.awaitingBoard && (
            <p className="text-[11px] text-slate-400">aguardando o valor da conta · <Link href="/investments" className="text-blue-600 dark:text-blue-400 hover:underline">informar em Investimentos</Link></p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 -mr-1.5 -mt-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors shrink-0">
            <MoreVertical className="h-4 w-4 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
            {linked && onRefresh && <DropdownMenuItem onClick={onRefresh}><RefreshCw className="h-4 w-4 mr-2" />Atualizar valor da conta</DropdownMenuItem>}
            {canLink && onPickBoard && <DropdownMenuItem onClick={onPickBoard}><Link2 className="h-4 w-4 mr-2" />{linked ? 'Trocar conta' : 'Vincular a uma conta'}</DropdownMenuItem>}
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-baseline justify-between mt-3">
        <span className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmt(goal.currentAmount)}</span>
        <span className="text-xs text-slate-400">de {fmt(goal.targetAmount)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] mt-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v.pct}%`, backgroundColor: goal.color }} />
      </div>

      {v.pct < 100 && (
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06] text-[10px] text-slate-400">
          <div>Necessário/mês<p className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{v.months > 0 ? fmt(v.monthly) : '—'}</p></div>
          <div>Ritmo<p className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{v.currentPace > 0 ? `${fmt(v.currentPace)}` : '—'}</p></div>
          <div>Previsão<p className={cn('text-xs font-semibold',
            v.status?.label === 'Adiantada' ? 'text-emerald-600' : v.status?.label === 'Atrasada' ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200')}>{v.projectedDate ?? '—'}</p></div>
        </div>
      )}
    </div>
  )
}

// ── Necessário × ritmo ─────────────────────────────────────────────────────
export function PaceChart({ items }: { items: GoalView[] }) {
  const rows = items.filter(active)
  if (rows.length === 0) return null
  // Escala: o maior valor (necessário ou ritmo) entre as metas vira 100%.
  const max = Math.max(...rows.map(v => Math.max(v.months > 0 ? v.monthly : 0, v.currentPace)), 1)
  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" /><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Necessário × ritmo</h3></div>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Cinza = quanto precisa guardar por mês · cor = quanto você vem guardando</p>
      <div className="space-y-2.5">
        {rows.map(v => {
          const need = v.months > 0 ? v.monthly : 0
          const gap = v.currentPace - need
          return (
            <div key={v.goal.id} className="grid grid-cols-[96px_minmax(0,1fr)_72px] gap-2 items-center text-[11px]">
              <span className="truncate text-slate-500 dark:text-slate-400" title={v.goal.name}>{v.goal.name}</span>
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" style={{ width: `${(need / max) * 100}%`, minWidth: need > 0 ? 4 : 0 }} />
                <div className="h-1.5 rounded-full" style={{ width: `${(v.currentPace / max) * 100}%`, minWidth: v.currentPace > 0 ? 4 : 0, backgroundColor: v.goal.color }} />
              </div>
              <span className={cn('text-right tabular-nums font-medium', need === 0 ? 'text-slate-400' : gap >= -0.5 ? 'text-emerald-600' : 'text-amber-500')}>
                {need === 0 ? '—' : gap >= -0.5 ? 'ok' : `−${fmt(Math.abs(gap)).replace(/,\d{2}$/, '')}`}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Linha do tempo dos prazos ──────────────────────────────────────────────
export function GoalsTimeline({ items }: { items: GoalView[] }) {
  const rows = [...items].sort((a, b) => a.goal.deadline.localeCompare(b.goal.deadline))
  if (rows.length === 0) return null
  return (
    <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" /><h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Linha do tempo</h3></div>
      <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Prazos das metas, do mais próximo ao mais distante</p>
      <ol className="relative ml-1.5 border-l-2 border-slate-100 dark:border-white/[0.08] pl-4 space-y-3">
        {rows.map(v => (
          <li key={v.goal.id} className="relative text-xs">
            <span className="absolute -left-[23px] top-0.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v.goal.color }} />
            <p className="font-semibold text-slate-700 dark:text-slate-200">{v.deadlineLabel} · {v.goal.name}</p>
            <p className="text-[11px] text-slate-400">
              {v.pct >= 100 ? 'concluída'
                : <>faltam {fmt(v.remaining)} · {v.projectedDate ? (v.status?.label === 'Atrasada' ? `no ritmo chega em ${v.projectedDate}` : 'no ritmo') : 'sem ritmo ainda'}</>}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ── Como funciona ──────────────────────────────────────────────────────────
function Item({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5 text-slate-400" /></span>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed"><strong className="text-slate-700 dark:text-slate-200">{title}</strong>{' '}{children}</p>
    </div>
  )
}

export function GoalsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>
      {open && (
        <div className="grid gap-4 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <Item icon={Flame} title="Necessário, ritmo e previsão.">
              Necessário/mês = quanto falta ÷ meses até o prazo. Ritmo = quanto já está guardado ÷ meses desde o início da
              meta (&ldquo;Meta iniciada em&rdquo;). Previsão = hoje + quanto falta ÷ ritmo.
            </Item>
            <Item icon={BarChart3} title="Necessário × ritmo.">
              Uma linha por meta em andamento: barra cinza é o necessário por mês, a colorida é o seu ritmo. A maior das duas,
              entre todas as metas, ocupa a largura inteira. &ldquo;ok&rdquo; = o ritmo cobre o necessário; senão mostra quanto falta por mês.
            </Item>
          </div>
          <div className="space-y-4">
            <Item icon={Link2} title="Meta ligada a uma conta.">
              O valor atual vem de uma conta de investimento e acompanha a conta: quando ela ganha um valor novo (planilha
              importada ou valor informado), a meta se atualiza sozinha.
            </Item>
            <Item icon={MoreVertical} title="Menu ⋮ de cada meta.">
              Editar, vincular ou trocar a conta, atualizar o valor da conta e excluir.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
