'use client'

import { useMemo, useState } from 'react'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { useEvents } from '@/hooks/use-events'
import { useSubcategories } from '@/hooks/use-subcategories'
import { CategoryConversionCard } from '@/components/categories/category-conversion-card'
import { Category, CategoryBucket, CategoryType, CATEGORY_COLORS, AppEvent } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Pencil, Trash2, Tag, RotateCcw, Search, AlertTriangle, ArrowRight,
  TrendingDown, TrendingUp, ChevronDown, ChevronRight, Sparkles, Lock, Unlock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<CategoryType, string> = {
  receita: 'Receita', despesa: 'Despesa', ambos: 'Ambos',
}

const TYPE_BADGE: Record<CategoryType, string> = {
  receita: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  despesa: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ambos:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

const BUCKET_LABELS: Record<CategoryBucket, string> = {
  essencial: 'Essencial', estilo: 'Estilo de vida', futuro: 'Futuro',
}

const NO_BUCKET = '__nenhuma__'
const NO_PARENT = '__principal__'

type SectionType = 'despesa' | 'receita'
const SECTION_ORDER: SectionType[] = ['despesa', 'receita']

const SECTION_META: Record<SectionType, { label: string; icon: React.ElementType; iconColor: string; iconBg: string; help: string }> = {
  despesa: {
    label: 'Despesas', icon: TrendingDown, iconColor: 'text-red-500', iconBg: 'bg-red-50 dark:bg-red-900/20',
    help: 'Dinheiro que sai de verdade: contas, compras, assinaturas... Conta como gasto real no saldo, no planejamento e nos relatórios.',
  },
  receita: {
    label: 'Receitas', icon: TrendingUp, iconColor: 'text-green-500', iconBg: 'bg-green-50 dark:bg-green-900/20',
    help: 'Dinheiro que entra: salário, freelance, vendas... Conta como ganho real no saldo, no dashboard e nos relatórios.',
  },
}

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface FormState {
  name: string
  type: CategoryType
  color: string
  bucket: CategoryBucket | null
  parentId: string | null
}

const EMPTY_FORM: FormState = {
  name: '', type: 'despesa', color: CATEGORY_COLORS[0], bucket: null, parentId: null,
}

interface MergeState { from: Category; toId: string }
interface EventFormState { name: string; color: string }

/**
 * Categorias em dois níveis (Categoria › Subcategoria) e Eventos na mesma tela.
 * Substitui as três telas antigas — Categorias, Subcategorias e Categorias
 * isoladas —, que separavam conceitos que o usuário enxerga juntos.
 */
export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory, seedDefaults, refetch } = useCategories()
  // Grupos antigos: só para oferecer a conversão a quem ainda não converteu.
  const { subcategories, loading: subcategoriesLoading } = useSubcategories()
  const { transactions } = useTransactions()
  const events = useEvents()

  const [tab, setTab] = useState<'categorias' | 'eventos'>('categorias')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [mergeState, setMergeState] = useState<MergeState | null>(null)
  const [merging, setMerging] = useState(false)

  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')

  const [eventForm, setEventForm] = useState<EventFormState>({ name: '', color: CATEGORY_COLORS[9] })
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null)
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState('')
  const [eventDeleteTarget, setEventDeleteTarget] = useState<AppEvent | null>(null)

  const usageCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) if (t.category) map[t.category] = (map[t.category] ?? 0) + 1
    return map
  }, [transactions])

  // Totais por evento: quanto saiu, quanto voltou (estorno/reembolso) e o período.
  const eventStats = useMemo(() => {
    const map: Record<string, { spent: number; received: number; count: number; first: string; last: string }> = {}
    for (const t of transactions) {
      if (!t.event_id) continue
      const s = map[t.event_id] ?? { spent: 0, received: 0, count: 0, first: t.date, last: t.date }
      if (t.type === 'despesa') s.spent += t.amount
      else s.received += t.amount
      s.count += 1
      if (t.date < s.first) s.first = t.date
      if (t.date > s.last) s.last = t.date
      map[t.event_id] = s
    }
    return map
  }, [transactions])

  const parents = useMemo(() => categories.filter(c => !c.parent_id), [categories])
  const childrenOf = useMemo(() => {
    const map = new Map<string, Category[]>()
    for (const c of categories) {
      if (!c.parent_id) continue
      const list = map.get(c.parent_id) ?? []
      list.push(c)
      map.set(c.parent_id, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    return map
  }, [categories])

  const q = search.trim().toLowerCase()
  const matches = (c: Category) => !q || c.name.toLowerCase().includes(q)

  const visibleParents = useMemo(() => {
    const list = parents.filter(p => matches(p) || (childrenOf.get(p.id) ?? []).some(matches))
    return list.sort((a, b) => {
      if (a.name.toLowerCase() === 'outros') return 1
      if (b.name.toLowerCase() === 'outros') return -1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
  }, [parents, childrenOf, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const bySection: Record<SectionType, Category[]> = {
    despesa: visibleParents.filter(c => c.type === 'despesa' || c.type === 'ambos'),
    receita: visibleParents.filter(c => c.type === 'receita' || c.type === 'ambos'),
  }

  const countWithChildren = (parent: Category) =>
    (usageCount[parent.name] ?? 0) +
    (childrenOf.get(parent.id) ?? []).reduce((s, ch) => s + (usageCount[ch.name] ?? 0), 0)

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function openCreate(parentId: string | null = null) {
    const parent = parentId ? categories.find(c => c.id === parentId) ?? null : null
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      parentId,
      type: parent && parent.type !== 'ambos' ? parent.type : 'despesa',
      color: parent?.color ?? CATEGORY_COLORS[0],
    })
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({
      name: cat.name, type: cat.type, color: cat.color,
      bucket: cat.bucket ?? null, parentId: cat.parent_id ?? null,
    })
    setFormError('')
    setFormOpen(true)
  }

  const isOutros = (c: Category) => c.name.toLowerCase() === 'outros'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Nome obrigatório.'); return }

    const parent = form.parentId ? categories.find(c => c.id === form.parentId) : null
    if (parent && parent.type !== 'ambos' && form.type !== 'ambos' && form.type !== parent.type) {
      setFormError(`"${parent.name}" é uma categoria de ${TYPE_LABELS[parent.type].toLowerCase()}. A subcategoria precisa ser do mesmo tipo (ou "Ambos").`)
      return
    }
    if (editing && form.parentId && (childrenOf.get(editing.id) ?? []).length > 0) {
      setFormError('Essa categoria tem subcategorias dentro dela. Mova ou exclua as subcategorias antes de colocá-la dentro de outra.')
      return
    }

    setSaving(true); setFormError('')
    const payload = {
      name: form.name, type: form.type, color: form.color,
      bucket: form.bucket, parent_id: form.parentId,
    }
    const { error } = editing
      ? await updateCategory(editing.id, payload)
      : await createCategory(payload)
    setSaving(false)
    if (error) {
      setFormError(error.includes('unique') || error.includes('duplicate') || error.includes('nome')
        ? 'Já existe uma categoria com esse nome.' : `Erro: ${error}`)
      return
    }
    setFormOpen(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true); setDeleteError('')

    // Subcategorias não são apagadas junto: vão para "Outros".
    const kids = childrenOf.get(deleteTarget.id) ?? []
    const outros = categories.find(isOutros)
    if (kids.length > 0 && outros) {
      for (const kid of kids) {
        const { error } = await updateCategory(kid.id, { parent_id: outros.id })
        if (error) { setDeleting(false); setDeleteError(error); return }
      }
    }

    const { error } = await deleteCategory(deleteTarget.id)
    setDeleting(false)
    if (error) { setDeleteError(error); return }
    setDeleteTarget(null)
  }

  async function confirmMerge() {
    if (!mergeState?.toId) return
    const target = categories.find(c => c.id === mergeState.toId)
    if (!target) return
    setMerging(true)

    // Subcategorias da origem passam para o destino antes da exclusão.
    for (const kid of childrenOf.get(mergeState.from.id) ?? []) {
      await updateCategory(kid.id, { parent_id: target.id })
    }
    // Renomear para o nome do destino move transações, regras e limites; a
    // exclusão em seguida não cascateia porque o nome continua em uso.
    await updateCategory(mergeState.from.id, { name: target.name })
    await deleteCategory(mergeState.from.id)
    setMergeState(null)
    setMerging(false)
  }

  async function handleSeedDefaults() {
    setSeeding(true); setSeedError('')
    const { error } = await seedDefaults()
    if (error) setSeedError(error)
    setSeeding(false)
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!eventForm.name.trim()) { setEventError('Nome obrigatório.'); return }
    setEventSaving(true); setEventError('')
    const { error } = editingEvent
      ? await events.updateEvent(editingEvent.id, { name: eventForm.name, color: eventForm.color })
      : await events.createEvent(eventForm)
    setEventSaving(false)
    if (error) { setEventError(error); return }
    setEventFormOpen(false)
  }

  const deleteCount = deleteTarget ? (usageCount[deleteTarget.name] ?? 0) : 0
  const deleteKids = deleteTarget ? (childrenOf.get(deleteTarget.id) ?? []).length : 0
  const mergeTargets = mergeState
    ? categories.filter(c =>
        c.id !== mergeState.from.id &&
        c.parent_id !== mergeState.from.id &&
        (c.type === mergeState.from.type || c.type === 'ambos' || mergeState.from.type === 'ambos'))
    : []
  const parentItems = [
    { value: NO_PARENT, label: 'Nenhuma (categoria principal)' },
    ...parents.filter(p => !editing || p.id !== editing.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map(p => ({ value: p.id, label: p.name })),
  ]
  const parentOptions = parents
    .filter(p => !editing || p.id !== editing.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  function renderCategoryRow(cat: Category, isChild: boolean) {
    const count = usageCount[cat.name] ?? 0
    return (
      <div
        key={cat.id}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2 transition-colors',
          isChild
            ? 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
            : 'bg-white dark:bg-slate-800 px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
        )}
      >
        {isChild ? (
          <span className="h-2 w-2 rounded-full shrink-0 ml-1" style={{ backgroundColor: cat.color }} />
        ) : (
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '25' }}>
            <Tag className="h-4 w-4" style={{ color: cat.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn('truncate', isChild
            ? 'text-sm text-slate-600 dark:text-slate-300'
            : 'font-semibold text-slate-700 dark:text-slate-200 text-sm')}>
            {cat.name}
          </p>
          {count > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {count} transaç{count === 1 ? 'ão' : 'ões'}
            </p>
          )}
        </div>
        {cat.bucket && !isChild && (
          <Badge className="text-[10px] shrink-0 border-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {BUCKET_LABELS[cat.bucket]}
          </Badge>
        )}
        {(cat.type === 'ambos' || !isChild) && (
          <Badge className={`text-xs shrink-0 border-0 ${TYPE_BADGE[cat.type]}`}>{TYPE_LABELS[cat.type]}</Badge>
        )}
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Mesclar com outra categoria"
            onClick={() => setMergeState({ from: cat, toId: '' })}>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(cat)}>
            <Pencil className="h-3.5 w-3.5 text-slate-400" />
          </Button>
          {!isOutros(cat) && (
            <Button variant="ghost" size="icon" title="Excluir"
              className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => { setDeleteError(''); setDeleteTarget(cat) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <CategoryConversionCard
        categories={categories}
        groups={subcategories}
        loading={loading || subcategoriesLoading}
        onDone={refetch}
      />

      {/* Abas */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {(['categorias', 'eventos'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700')}>
            {t === 'categorias' ? 'Categorias' : 'Eventos'}
          </button>
        ))}
      </div>

      {tab === 'categorias' ? (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {parents.length} categorias · {categories.length - parents.length} subcategorias
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
                <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                Restaurar padrões
              </Button>
              <Button size="sm" onClick={() => openCreate(null)} className="gap-2">
                <Plus className="h-4 w-4" /> Nova categoria
              </Button>
            </div>
          </div>

          {seedError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              Erro ao restaurar: {seedError}
            </div>
          )}

          {categories.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar categoria ou subcategoria..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Tag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria ainda</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Crie uma nova ou comece pelas categorias padrão</p>
              </div>
              <Button onClick={handleSeedDefaults} disabled={seeding} variant="outline" className="gap-2">
                <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Criando...' : 'Criar categorias padrão'}
              </Button>
            </div>
          ) : visibleParents.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Nada encontrado para &ldquo;{search}&rdquo;</p>
          ) : (
            <div className="space-y-6">
              {SECTION_ORDER.map(type => {
                const items = bySection[type]
                if (items.length === 0) return null
                const { label, icon: Icon, iconColor, iconBg, help } = SECTION_META[type]
                return (
                  <section key={type} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconBg)}>
                        <Icon className={cn('h-4 w-4', iconColor)} />
                      </div>
                      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{label}</h2>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 ml-9 -mt-1">{help}</p>

                    <div className="space-y-2">
                      {items.map(parent => {
                        const kids = (childrenOf.get(parent.id) ?? []).filter(k => !q || matches(k) || matches(parent))
                        const open = !collapsed.has(parent.id)
                        const total = countWithChildren(parent)
                        return (
                          <div key={parent.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-1 pl-2">
                              <button type="button" onClick={() => toggle(parent.id)}
                                className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 shrink-0"
                                title={open ? 'Recolher' : 'Expandir'}>
                                {kids.length > 0
                                  ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)
                                  : <span className="h-4 w-4" />}
                              </button>
                              <div className="flex-1 min-w-0">{renderCategoryRow(parent, false)}</div>
                            </div>

                            {open && (
                              <div className="pb-2 pl-10 pr-2">
                                {kids.length > 0 && (
                                  <div className="border-l-2 border-slate-100 dark:border-white/[0.08] pl-2">
                                    {kids.map(kid => renderCategoryRow(kid, true))}
                                  </div>
                                )}
                                <button type="button" onClick={() => openCreate(parent.id)}
                                  className="mt-1 ml-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                  <Plus className="h-3.5 w-3.5" /> Nova subcategoria
                                </button>
                              </div>
                            )}

                            {!open && total > 0 && (
                              <p className="px-4 pb-2 text-xs text-slate-400 dark:text-slate-500">
                                {kids.length} subcategoria{kids.length === 1 ? '' : 's'} · {total} transaç{total === 1 ? 'ão' : 'ões'} no total
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* ---------------- EVENTOS ---------------- */
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {events.events.length} evento{events.events.length === 1 ? '' : 's'}
            </p>
            <Button size="sm" className="gap-2"
              onClick={() => { setEditingEvent(null); setEventForm({ name: '', color: CATEGORY_COLORS[9] }); setEventError(''); setEventFormOpen(true) }}>
              <Plus className="h-4 w-4" /> Novo evento
            </Button>
          </div>

          <div className="flex items-start gap-2.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-xl p-3.5">
            <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
            <p className="text-sm text-violet-700 dark:text-violet-300">
              Evento é uma etiqueta por cima da categoria: uma viagem, uma reforma, um campeonato.
              O lançamento continua na categoria normal (Alimentação, Transporte...) <strong>e</strong> soma
              no evento, então você vê quanto custou sem bagunçar os relatórios do mês.
              Quando acabar, <strong>encerre</strong> o evento: ele some da lista ao lançar, mas continua nos relatórios.
            </p>
          </div>

          {events.loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />)}
            </div>
          ) : events.events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Sparkles className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-600 dark:text-slate-300">Nenhum evento ainda</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">Crie um quando for fazer uma viagem ou uma reforma</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.events.map(ev => {
                const s = eventStats[ev.id]
                return (
                  <div key={ev.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ev.color + '25' }}>
                      <Sparkles className="h-4 w-4" style={{ color: ev.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">
                        {ev.name}
                        {ev.closed && <span className="ml-2 text-[10px] font-medium text-slate-400">encerrado</span>}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {s
                          ? `${s.count} lançamento${s.count === 1 ? '' : 's'} · ${s.first.split('-').reverse().join('/')} a ${s.last.split('-').reverse().join('/')}`
                          : 'Nenhum lançamento marcado ainda'}
                      </p>
                    </div>
                    {s && (
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-500 tabular-nums">{money(s.spent)}</p>
                        {s.received > 0.005 && (
                          <p className="text-xs text-green-600 dark:text-green-400 tabular-nums">+{money(s.received)}</p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        title={ev.closed ? 'Reabrir evento' : 'Encerrar evento'}
                        onClick={() => events.updateEvent(ev.id, { closed: !ev.closed })}>
                        {ev.closed ? <Unlock className="h-3.5 w-3.5 text-slate-400" /> : <Lock className="h-3.5 w-3.5 text-slate-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                        onClick={() => { setEditingEvent(ev); setEventForm({ name: ev.name, color: ev.color }); setEventError(''); setEventFormOpen(true) }}>
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir"
                        className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setEventDeleteTarget(ev)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* FORM CATEGORIA */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar categoria' : form.parentId ? 'Nova subcategoria' : 'Nova categoria'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {formError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input id="cat-name" placeholder="Ex: Mercado, Aluguel, Streaming..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>

            <div className="space-y-2">
              <Label>Dentro de</Label>
              <Select
                items={parentItems}
                value={form.parentId ?? NO_PARENT}
                onValueChange={v => {
                  if (!v) return
                  const parentId = v === NO_PARENT ? null : v
                  const parent = parentId ? categories.find(c => c.id === parentId) : null
                  setForm(f => ({
                    ...f,
                    parentId,
                    type: parent && parent.type !== 'ambos' ? parent.type : f.type,
                  }))
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Nenhuma (categoria principal)</SelectItem>
                  {parentOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Escolher uma categoria aqui transforma esta em subcategoria dela.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => v && setForm(f => ({ ...f, type: v as CategoryType }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Etiqueta 50/30/20</Label>
              <Select
                value={form.bucket ?? NO_BUCKET}
                onValueChange={v => v && setForm(f => ({ ...f, bucket: v === NO_BUCKET ? null : v as CategoryBucket }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BUCKET}>Nenhuma</SelectItem>
                  <SelectItem value="essencial">Essencial</SelectItem>
                  <SelectItem value="estilo">Estilo de vida</SelectItem>
                  <SelectItem value="futuro">Futuro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Sugestão para o Planejamento: quanto do seu dinheiro vai para o essencial, para o estilo de vida e para o futuro.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CATEGORY_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#1e293b' : 'transparent',
                      outline: form.color === color ? '2px solid white' : 'none', outlineOffset: '-3px',
                    }} />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EXCLUIR CATEGORIA */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir categoria</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tem certeza que deseja excluir <strong className="text-slate-700 dark:text-slate-200">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
            </p>
            {(deleteCount > 0 || deleteKids > 0) && (
              <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">Atenção</p>
                  {deleteCount > 0 && (
                    <p className="mt-0.5">
                      {deleteCount} transaç{deleteCount === 1 ? 'ão usa' : 'ões usam'} essa categoria. Elas vão para &ldquo;Outros&rdquo;,
                      junto com as regras automáticas e os limites de planejamento que apontam para ela.
                    </p>
                  )}
                  {deleteKids > 0 && (
                    <p className="mt-1">
                      As {deleteKids} subcategorias dentro dela não são apagadas: passam para &ldquo;Outros&rdquo;.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Dica: use &ldquo;Mesclar&rdquo; (→) para mandar tudo para uma categoria específica.
                  </p>
                </div>
              </div>
            )}
            {deleteError && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MESCLAR */}
      <Dialog open={!!mergeState} onOpenChange={v => { if (!v) setMergeState(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mesclar categoria</DialogTitle></DialogHeader>
          {mergeState && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todos os lançamentos de <strong className="text-slate-700 dark:text-slate-200">&ldquo;{mergeState.from.name}&rdquo;</strong> vão
                para a categoria escolhida, e &ldquo;{mergeState.from.name}&rdquo; deixa de existir.
                Subcategorias dentro dela também passam para lá.
              </p>
              <div className="space-y-2">
                <Label>Categoria destino</Label>
                <Select
                  value={mergeState.toId}
                  onValueChange={v => v && setMergeState(s => s ? { ...s, toId: v } : null)}
                  items={mergeTargets.map(c => ({
                    value: c.id,
                    label: c.parent_id
                      ? `${categories.find(p => p.id === c.parent_id)?.name ?? ''} › ${c.name}`
                      : c.name,
                  }))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {mergeTargets.length === 0 ? (
                      <SelectItem value="__empty__" disabled>Nenhuma categoria disponível</SelectItem>
                    ) : mergeTargets.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.parent_id ? `${categories.find(p => p.id === c.parent_id)?.name ?? ''} › ${c.name}` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setMergeState(null)} className="flex-1">Cancelar</Button>
                <Button onClick={confirmMerge} disabled={!mergeState.toId || merging} className="flex-1">
                  {merging ? 'Mesclando...' : 'Mesclar e excluir'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FORM EVENTO */}
      <Dialog open={eventFormOpen} onOpenChange={v => { if (!v) setEventFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingEvent ? 'Editar evento' : 'Novo evento'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEvent} className="space-y-4 pt-2">
            {eventError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {eventError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="ev-name">Nome</Label>
              <Input id="ev-name" placeholder="Ex: Viagem Rio, Reforma, Campeonato..." value={eventForm.name}
                onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CATEGORY_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setEventForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: eventForm.color === color ? '#1e293b' : 'transparent',
                      outline: eventForm.color === color ? '2px solid white' : 'none', outlineOffset: '-3px',
                    }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEventFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={eventSaving} className="flex-1">
                {eventSaving ? 'Salvando...' : editingEvent ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EXCLUIR EVENTO */}
      <Dialog open={!!eventDeleteTarget} onOpenChange={v => { if (!v) setEventDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir evento</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Excluir <strong className="text-slate-700 dark:text-slate-200">&ldquo;{eventDeleteTarget?.name}&rdquo;</strong>?
              Nenhum lançamento é apagado — eles só deixam de estar marcados com esse evento.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setEventDeleteTarget(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" className="flex-1"
                onClick={async () => { if (eventDeleteTarget) { await events.deleteEvent(eventDeleteTarget.id); setEventDeleteTarget(null) } }}>
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
