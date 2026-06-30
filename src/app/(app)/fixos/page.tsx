'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRecurring, RecurringItem } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { useSubcategories } from '@/hooks/use-subcategories'
import { createClient } from '@/lib/supabase/client'
import {
  RefreshCw, CheckCircle, EyeOff, Eye, AlertCircle, Clock,
  Layers, Plus, Tag, ChevronDown, X,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Agrupamento ───────────────────────────────────────────────────────────────
interface DisplayItem {
  key: string
  name: string
  avgAmount: number
  monthsCount: number
  lastDate: string
  category: string
  subcategory: string | null
  isGroup: boolean
  descriptions: string[]
  is_recurring: boolean
}

function buildDisplayItems(
  recurring: RecurringItem[],
  overrides: Map<string, string | null>,
): DisplayItem[] {
  // Aplica overrides locais antes de agrupar
  const withOverrides = recurring.map(r => ({
    ...r,
    group_label: overrides.has(r.description) ? overrides.get(r.description)! : r.group_label,
  }))

  const grouped = new Map<string, typeof withOverrides>()
  const singles: typeof withOverrides = []

  for (const r of withOverrides) {
    const label = r.group_label?.trim() || null
    if (label) {
      const existing = grouped.get(label) ?? []
      existing.push(r)
      grouped.set(label, existing)
    } else {
      singles.push(r)
    }
  }

  const items: DisplayItem[] = []

  for (const [label, members] of grouped.entries()) {
    const totalCount = members.reduce((s, r) => s + r.monthsCount, 0)
    const avgAmount = totalCount > 0
      ? members.reduce((s, r) => s + r.avgAmount * r.monthsCount, 0) / totalCount
      : 0
    const lastDate = members.reduce((max, r) => r.lastDate > max ? r.lastDate : max, '')
    items.push({
      key: `group:${label}`,
      name: label,
      avgAmount,
      monthsCount: totalCount,
      lastDate,
      category: members[0]?.category ?? '',
      subcategory: label,
      isGroup: true,
      descriptions: members.map(r => r.description),
      is_recurring: members.some(r => r.is_recurring ?? false),
    })
  }

  for (const r of singles) {
    items.push({
      key: r.description.toLowerCase(),
      name: r.description,
      avgAmount: r.avgAmount,
      monthsCount: r.monthsCount,
      lastDate: r.lastDate,
      category: r.category,
      subcategory: r.group_label ?? null,
      isGroup: false,
      descriptions: [r.description],
      is_recurring: r.is_recurring ?? false,
    })
  }

  return items.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount)
}

// ── Dropdown de subcategoria ──────────────────────────────────────────────────
function SubcategoryDropdown({
  value, subcategories, onSelect, saving,
}: {
  value: string | null
  subcategories: string[]
  onSelect: (v: string | null) => void
  saving: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
          saving
            ? 'opacity-50 cursor-wait'
            : value
              ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 hover:border-violet-400'
              : 'text-slate-400 border-dashed border-slate-300 dark:border-slate-600 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-600'
        )}
      >
        {saving
          ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          : value
            ? <><Tag className="h-2.5 w-2.5" />{value}<ChevronDown className="h-2.5 w-2.5" /></>
            : <><Plus className="h-2.5 w-2.5" />subcat.</>
        }
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg min-w-44 py-1">
          {subcategories.length === 0 ? (
            <div className="px-3 py-2 space-y-1">
              <p className="text-xs text-slate-400">Nenhuma subcategoria criada.</p>
              <Link
                href="/settings/subcategories"
                className="text-xs text-violet-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                Criar subcategorias →
              </Link>
            </div>
          ) : (
            subcategories.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { onSelect(s); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex items-center gap-2',
                  value === s
                    ? 'text-violet-700 dark:text-violet-300 font-medium'
                    : 'text-slate-700 dark:text-slate-200'
                )}
              >
                {value === s && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
                {s}
              </button>
            ))
          )}
          {value && (
            <>
              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
              <button
                type="button"
                onClick={() => { onSelect(null); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5"
              >
                <X className="h-3 w-3" /> Remover subcategoria
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Card de item ──────────────────────────────────────────────────────────────
function ItemCard({
  item, decision, subcategories, onConfirm, onIgnore, onUndo, onSelectSubcategory,
}: {
  item: DisplayItem
  decision: 'confirmed' | 'ignored' | null
  subcategories: string[]
  onConfirm: () => void
  onIgnore: () => void
  onUndo: () => void
  onSelectSubcategory: (label: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const isPending = decision === null
  const borderCls = item.isGroup
    ? 'border-violet-200 dark:border-violet-800/50'
    : isPending
      ? 'border-amber-200 dark:border-amber-800/40'
      : 'border-emerald-200 dark:border-emerald-800/40'

  async function handleSelect(label: string | null) {
    setSaving(true)
    await onSelectSubcategory(label)
    setSaving(false)
  }

  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-4', borderCls)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-start gap-3 flex-1">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
            item.isGroup
              ? 'bg-violet-50 dark:bg-violet-900/30'
              : isPending
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-emerald-50 dark:bg-emerald-900/30'
          )}>
            {item.isGroup
              ? <Layers className="h-4 w-4 text-violet-500" />
              : isPending
                ? <Clock className="h-4 w-4 text-amber-500" />
                : <CheckCircle className="h-4 w-4 text-emerald-500" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{item.name}</p>

            {/* Categoria + Subcategoria */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                {item.category}
              </span>
              <span className="text-slate-300 dark:text-slate-600 text-xs select-none">›</span>
              <SubcategoryDropdown
                value={item.subcategory}
                subcategories={subcategories}
                onSelect={handleSelect}
                saving={saving}
              />
              {item.isGroup && (
                <span className="text-xs text-slate-400">· {item.descriptions.length} descrições</span>
              )}
            </div>

            {item.isGroup && (
              <div className="mt-2 space-y-0.5">
                {item.descriptions.map(d => (
                  <p key={d} className="text-xs text-slate-400 dark:text-slate-500 truncate">• {d}</p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />{item.monthsCount}x detectado
              </span>
              <span className="text-xs text-slate-400">última: {formatDate(item.lastDate)}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmt(item.avgAmount)}</p>
          <p className="text-xs text-slate-400">média/mês</p>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        {isPending ? (
          <>
            <Button size="sm" variant="outline"
              className="flex-1 h-8 text-xs gap-1.5 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={onConfirm}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirmar como fixo
            </Button>
            <Button size="sm" variant="ghost"
              className="h-8 text-xs gap-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onIgnore}>
              <EyeOff className="h-3.5 w-3.5" /> Ignorar
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost"
            className="h-8 text-xs gap-1.5 text-slate-400 hover:text-slate-600"
            onClick={onUndo}>
            <RefreshCw className="h-3 w-3" /> Desfazer confirmação
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FixosPage() {
  const { recurring, loading, refetch: refetchRecurring }         = useRecurring()
  const { decisions, loading: decisionsLoading, setDecision }     = useRecurringDecisions()
  const { subcategories, loading: subLoading, assignSubcategory, refetch: refetchSubs } = useSubcategories()


  const [showIgnored, setShowIgnored] = useState(false)

  // Overrides otimistas: atualiza o UI antes do banco confirmar
  const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map())

  const displayItems = useMemo(
    () => buildDisplayItems(recurring, overrides),
    [recurring, overrides],
  )

  const pendingItems   = displayItems.filter(i => !decisions.has(i.key))
  const confirmedItems = displayItems.filter(i => decisions.get(i.key) === 'confirmed')
  const ignoredItems   = displayItems.filter(i => decisions.get(i.key) === 'ignored')
  const totalMonthly   = confirmedItems.reduce((s, i) => s + i.avgAmount, 0)

  // Sync is_recurring for existing confirmed/ignored items (retroactive fix)
  const syncedRef = useRef(false)
  useEffect(() => {
    if (loading || decisionsLoading || displayItems.length === 0 || syncedRef.current) return
    syncedRef.current = true

    async function sync() {
      // Only propagate confirmed → is_recurring=true (never auto-revert)
      const toTrue: string[] = []
      for (const item of displayItems) {
        const d = decisions.get(item.key)
        if (d === 'confirmed' && !item.is_recurring) toTrue.push(...item.descriptions)
      }
      if (toTrue.length === 0) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('transactions').update({ is_recurring: true }).eq('user_id', user.id).in('description', toTrue)
      refetchRecurring()
    }

    sync()
  }, [loading, decisionsLoading, displayItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm(item: DisplayItem) {
    setDecision(item.key, 'confirmed')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: true })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  async function handleIgnore(item: DisplayItem) {
    setDecision(item.key, 'ignored')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: false })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  async function handleUndo(item: DisplayItem) {
    setDecision(item.key, null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: false })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  async function handleSelectSubcategory(item: DisplayItem, label: string | null) {
    // Atualiza o UI imediatamente (otimista)
    setOverrides(prev => {
      const next = new Map(prev)
      item.descriptions.forEach(d => next.set(d, label))
      return next
    })

    const ok = await assignSubcategory(item.descriptions, label)
    if (ok) {
      refetchRecurring()
      refetchSubs()
    } else {
      // Reverte se falhou
      setOverrides(prev => {
        const next = new Map(prev)
        item.descriptions.forEach(d => next.delete(d))
        return next
      })
    }
  }

  const isLoading = loading || decisionsLoading || subLoading

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const renderCards = (items: DisplayItem[], decision: 'confirmed' | 'ignored' | null) =>
    items.map(item => (
      <ItemCard
        key={item.key}
        item={item}
        decision={decision}
        subcategories={subcategories}
        onConfirm={() => handleConfirm(item)}
        onIgnore={() => handleIgnore(item)}
        onUndo={() => handleUndo(item)}
        onSelectSubcategory={label => handleSelectSubcategory(item, label)}
      />
    ))

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Recorrências</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Cobranças fixas detectadas nos últimos 12 meses
          </p>
        </div>
        <Link
          href="/settings/subcategories"
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <Tag className="h-4 w-4" />
          Subcategorias
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Fixos confirmados / mês</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{fmt(totalMonthly)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{confirmedItems.length} item{confirmedItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Aguardando revisão</p>
          <p className="text-xl font-bold text-amber-500 mt-1">{pendingItems.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">cobrança{pendingItems.length !== 1 ? 's' : ''} detectada{pendingItems.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {recurring.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          iconColor="text-sky-500"
          iconBg="bg-sky-50 dark:bg-sky-500/15"
          title="Nenhuma cobrança fixa detectada"
          description="O app detecta automaticamente despesas que aparecem em 2 ou mais meses consecutivos."
          primaryLabel="Importar extrato"
          primaryHref="/import"
          secondaryLabel="Como funciona"
          secondaryHref="/help"
        />
      )}

      {pendingItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aguardando revisão</p>
            <span className="text-xs text-slate-400">({pendingItems.length})</span>
          </div>
          {renderCards(pendingItems, null)}
        </div>
      )}

      {confirmedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmados como fixos</p>
            <span className="text-xs text-slate-400">({confirmedItems.length})</span>
          </div>
          {renderCards(confirmedItems, 'confirmed')}
        </div>
      )}

      {ignoredItems.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowIgnored(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {showIgnored ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showIgnored ? 'Ocultar ignorados' : `Ver ${ignoredItems.length} ignorado${ignoredItems.length !== 1 ? 's' : ''}`}
          </button>
          {showIgnored && (
            <div className="space-y-2 mt-3 opacity-60">
              {ignoredItems.map(item => (
                <div key={item.key} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{item.name}</p>
                    <p className="text-xs text-slate-400">{fmt(item.avgAmount)} · {item.monthsCount}x</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-slate-600"
                    onClick={() => setDecision(item.key, null)}>
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
