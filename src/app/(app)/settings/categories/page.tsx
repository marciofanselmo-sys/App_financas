'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { useEvents } from '@/hooks/use-events'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { createClient } from '@/lib/supabase/client'
import { EventsTab } from '@/components/categories/events-tab'
import { useSubcategories } from '@/hooks/use-subcategories'
import { useRules } from '@/hooks/use-rules'
import { categoriesForDate } from '@/lib/special-category-filter'
import { CategoryOptions } from '@/components/categories/category-options'
import { CategoryConversionCard } from '@/components/categories/category-conversion-card'
import { Category, CategoryBucket, CategoryType, CATEGORY_COLORS, AppEvent, Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Pencil, Trash2, Tag, RotateCcw, Search, AlertTriangle, ArrowRight,
  TrendingDown, TrendingUp, ChevronDown, ChevronRight, Loader2,
  MoreVertical, Split, Compass, AlertCircle,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CategoriesHelp } from '@/components/categories/categories-help'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { cn } from '@/lib/utils'
import { CATEGORY_ICONS, CategoryIcon, categoryIconKey, guessIconKey } from '@/lib/category-icons'
import { isInternalMovement } from '@/lib/internal-movement'

const TYPE_LABELS: Record<CategoryType, string> = {
  receita: 'Receita', despesa: 'Despesa', ambos: 'Ambos',
}


const BUCKET_LABELS: Record<CategoryBucket, string> = {
  essencial: 'Essencial', estilo: 'Estilo de vida', futuro: 'Futuro',
}

// Mesmas cores do card "Pilares 50/30/20".
const BUCKET_BADGE: Record<CategoryBucket, string> = {
  essencial: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  estilo: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  futuro: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const NO_BUCKET = '__nenhuma__'
const NO_PARENT = '__principal__'

type SectionType = 'despesa' | 'receita'

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface FormState {
  name: string
  type: CategoryType
  color: string
  bucket: CategoryBucket | null
  parentId: string | null
  // null = ainda não escolhido: segue a sugestão pelo nome enquanto digita.
  icon: string | null
}

const EMPTY_FORM: FormState = {
  name: '', type: 'despesa', color: CATEGORY_COLORS[0], bucket: null, parentId: null, icon: null,
}

// A seta na linha agora MOVE (troca a mãe, sem tocar em lançamento nenhum).
// Juntar duas categorias continua existindo, mas escondido atrás de uma
// confirmação explícita: ela renomeia os lançamentos da origem e apaga a
// categoria — não tem desfazer, e o banco não guarda histórico.
type MoveMode = 'mover' | 'juntar'
interface MergeState { from: Category; toId: string; mode: MoveMode }
interface EventFormState { name: string; color: string }

function RowIcon({ iconKey, color }: { iconKey: string; color: string }) {
  return <CategoryIcon iconKey={iconKey} className="h-4 w-4" style={{ color }} />
}

/**
 * Categorias em dois níveis (Categoria › Subcategoria) e Eventos na mesma tela.
 * Substitui as três telas antigas — Categorias, Subcategorias e Categorias
 * isoladas —, que separavam conceitos que o usuário enxerga juntos.
 */
export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory, seedDefaults, refetch } = useCategories()
  // Grupos antigos: só para oferecer a conversão a quem ainda não converteu.
  const { subcategories, loading: subcategoriesLoading } = useSubcategories()
  const { transactions, refetch: refetchTransactions } = useTransactions()
  const { syncCategoryToRule } = useRules()
  const events = useEvents()
  const { boards } = useTransactionBoards()

  // Marca um lançamento do período no evento (só a etiqueta).
  async function addToEvent(tx: Transaction, ev: AppEvent) {
    const supabase = createClient()
    await supabase.from('transactions').update({ event_id: ev.id }).eq('id', tx.id)
    await refetchTransactions()
  }

  // Tira um lançamento do evento (só limpa a etiqueta; categoria e valor ficam).
  async function removeFromEvent(tx: Transaction) {
    const supabase = createClient()
    await supabase.from('transactions').update({ event_id: null }).eq('id', tx.id)
    await refetchTransactions()
  }

  const [tab, setTab] = useState<'categorias' | 'eventos'>('categorias')
  const [search, setSearch] = useState('')
  // Tudo começa recolhido; o usuário abre só o card que quer ver.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
  const [splitting, setSplitting] = useState<string | null>(null)
  const [splitState, setSplitState] = useState<{ cat: Category; parentId: string | null } | null>(null)

  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')

  const [eventForm, setEventForm] = useState<EventFormState>({ name: '', color: CATEGORY_COLORS[9] })
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null)
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState('')
  const [eventDeleteTarget, setEventDeleteTarget] = useState<AppEvent | null>(null)

  // Por nome E tipo: o mesmo nome pode existir em despesa e em receita, e sem
  // separar as duas mostravam a mesma contagem — impossível saber qual delas
  // tem lançamento de verdade na hora de limpar duplicadas.
  const usageCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      if (!t.category) continue
      const byName = t.category.trim().toLowerCase()
      map[`${t.type}|${byName}`] = (map[`${t.type}|${byName}`] ?? 0) + 1
    }
    return map
  }, [transactions])

  // Lançamentos que estão direto na categoria-mãe, sem subcategoria — é o
  // caso dos centenas em "Outros". Viram uma linha "Outros › Outros" dentro
  // do card, agrupados por descrição para reclassificar de uma vez.
  const [openDirect, setOpenDirect] = useState<string | null>(null)
  const [movingGroup, setMovingGroup] = useState<string | null>(null)
  const [moveError, setMoveError] = useState('')
  const txsByTypeName = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of transactions) {
      if (!t.category) continue
      const k = `${t.type}|${t.category.trim().toLowerCase()}`
      const list = map.get(k) ?? []
      list.push(t)
      map.set(k, list)
    }
    return map
  }, [transactions])

  function groupByDescription(txs: Transaction[]) {
    const groups = new Map<string, { description: string; txs: Transaction[]; total: number; last: string }>()
    for (const t of txs) {
      const k = t.description.trim().toUpperCase()
      const g = groups.get(k) ?? { description: t.description.trim(), txs: [], total: 0, last: t.date }
      g.txs.push(t)
      g.total += Number(t.amount)
      if (t.date > g.last) g.last = t.date
      groups.set(k, g)
    }
    return [...groups.values()].sort((a, b) => b.txs.length - a.txs.length || b.total - a.total)
  }

  // Muda a categoria do grupo inteiro: a regra automática (correspondência
  // exata) move todos os lançamentos com essa descrição e os próximos da importação.
  async function moveGroup(key: string, description: string, category: string) {
    setMovingGroup(key)
    setMoveError('')
    const { error } = await syncCategoryToRule(description, category, categories)
    if (error) setMoveError(error)
    await refetchTransactions()
    setMovingGroup(null)
  }

  // "ambos" soma os dois tipos.
  const countOf = (cat: Category) => {
    const n = cat.name.trim().toLowerCase()
    return cat.type === 'ambos'
      ? (usageCount[`despesa|${n}`] ?? 0) + (usageCount[`receita|${n}`] ?? 0)
      : (usageCount[`${cat.type}|${n}`] ?? 0)
  }

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

  function toggle(id: string) {
    setExpanded(prev => {
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
      bucket: cat.bucket ?? null, parentId: cat.parent_id ?? null, icon: cat.icon ?? null,
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
      // Subcategoria usa o ícone da mãe; o hook também acerta a cor dela.
      icon: form.parentId ? null : (form.icon ?? guessIconKey(form.name)),
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

  // Mover: só troca a mãe. A categoria continua existindo, com o mesmo nome,
  // e nenhum lançamento é tocado.
  // "Ambos" legado vira duas categorias de mesmo nome: esta fica como despesa,
  // e nasce uma de receita na categoria-mãe que o usuário escolher (a mãe de
  // despesa não serve para a metade de receita). Nenhum lançamento é tocado —
  // cada um passa a resolver pela categoria do seu próprio tipo.
  async function confirmSplit() {
    if (!splitState) return
    setSplitting(splitState.cat.id)
    const { error: createError } = await createCategory({
      name: splitState.cat.name,
      type: 'receita',
      color: splitState.cat.color,
      bucket: null,
      parent_id: splitState.parentId,
    })
    if (!createError) await updateCategory(splitState.cat.id, { type: 'despesa' })
    setSplitting(null)
    setSplitState(null)
    await refetch()
  }

  async function confirmMove() {
    if (!mergeState?.toId) return
    setMerging(true)
    const { error } = await updateCategory(mergeState.from.id, { parent_id: mergeState.toId })
    setMerging(false)
    if (error) return
    setMergeState(null)
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

  const deleteCount = deleteTarget ? countOf(deleteTarget) : 0
  // Excluir só mexe em lançamentos se nenhuma outra categoria ficar com o
  // mesmo nome (ver deleteCategory em use-categories.ts).
  const deleteHasTwin = !!deleteTarget && categories.some(
    c => c.id !== deleteTarget.id && c.name.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase())
  const deleteKids = deleteTarget ? (childrenOf.get(deleteTarget.id) ?? []).length : 0
  const mergeTargets = mergeState
    ? categories.filter(c =>
        c.id !== mergeState.from.id &&
        c.parent_id !== mergeState.from.id &&
        // Mover: a nova mãe precisa ser categoria principal (o app tem dois
        // níveis, não três).
        (mergeState.mode === 'juntar' || !c.parent_id) &&
        (c.type === mergeState.from.type || c.type === 'ambos' || mergeState.from.type === 'ambos'))
    : []
  const mergeCount = mergeState ? countOf(mergeState.from) : 0
  const incomeParents = parents
    .filter(p => p.type === 'receita' || p.type === 'ambos')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const parentItems = [
    { value: NO_PARENT, label: 'Nenhuma (categoria principal)' },
    ...parents.filter(p => !editing || p.id !== editing.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map(p => ({ value: p.id, label: p.name })),
  ]
  const parentOptions = parents
    .filter(p => !editing || p.id !== editing.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  function renderDirectRow(parent: Category, type: SectionType, direct: Transaction[]) {
    const key = `${type}|${parent.id}`
    const open = openDirect === key
    const total = direct.reduce((sum, t) => sum + Number(t.amount), 0)
    const groups = open ? groupByDescription(direct) : []
    return (
      <div>
        <button
          type="button"
          onClick={() => { setOpenDirect(open ? null : key); setMoveError('') }}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <span className="h-2 w-2 rounded-full shrink-0 ml-1 bg-slate-300 dark:bg-slate-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
              {parent.name}
              <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                sem subcategoria
              </span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {direct.length} transaç{direct.length === 1 ? 'ão' : 'ões'} · {money(total)}
            </p>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
        </button>

        {open && (
          <div className="ml-4 mt-1 mb-2 space-y-1">
            <p className="text-xs text-slate-400 dark:text-slate-500 px-2 pb-1">
              Agrupados por descrição. Escolha a categoria certa: todos os lançamentos com a mesma
              descrição mudam juntos, e os próximos já chegam classificados.
            </p>
            {moveError && (
              <p className="text-xs text-red-500 px-2 pb-1">{moveError}</p>
            )}
            {groups.map(g => {
              const gKey = `${type}|${g.description.toUpperCase()}`
              const usable = categoriesForDate(categories, g.last).filter(c => c.type === type || c.type === 'ambos')
              return (
                <div key={gKey} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{g.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {g.txs.length}× · último em {g.last.split('-').reverse().join('/')}
                    </p>
                  </div>
                  <span className={cn('text-sm tabular-nums shrink-0', type === 'receita' ? 'text-green-600' : 'text-red-500')}>
                    {money(g.total)}
                  </span>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {movingGroup === gKey && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    <Select
                      value={parent.name}
                      onValueChange={v => v && v !== parent.name && moveGroup(gKey, g.description, v)}
                      disabled={movingGroup !== null}
                    >
                      <SelectTrigger className="h-7 text-xs px-2 w-auto min-w-[120px] border-dashed">
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <CategoryOptions list={usable} all={categories} className="text-xs" />
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Subcategoria sempre com a cor da mãe.
  function colorOfMother(cat: Category) {
    return (cat.parent_id && categories.find(c => c.id === cat.parent_id)?.color) || cat.color
  }

  // ⋮ de cada linha: as ações que antes eram três ícones soltos.
  function renderActions(cat: Category, isChild: boolean) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0"
          aria-label={`Ações de ${cat.name}`}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {!isChild && (
            <DropdownMenuItem onClick={() => { setExpanded(prev => new Set(prev).add(cat.id)); openCreate(cat.id) }}>
              <Plus className="h-4 w-4 mr-2" /> Nova subcategoria
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openEdit(cat)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMergeState({ from: cat, toId: '', mode: 'mover' })}>
            <ArrowRight className="h-4 w-4 mr-2" /> Mover para outra categoria
          </DropdownMenuItem>
          {cat.type === 'ambos' && !isOutros(cat) && (
            <DropdownMenuItem disabled={splitting === cat.id} onClick={() => setSplitState({ cat, parentId: null })}>
              <Split className="h-4 w-4 mr-2" /> Separar em despesa e receita
            </DropdownMenuItem>
          )}
          {!isOutros(cat) && (
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setDeleteError(''); setDeleteTarget(cat) }}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Subcategoria: ponto na cor da mãe, nome, lançamentos, média e ⋮.
  function renderChild(kid: Category, parent: Category) {
    const count = countOf(kid)
    // Tipo diferente do da mãe não quebra conta nenhuma (o cálculo usa o tipo
    // do lançamento), mas embaralha a leitura dos relatórios — vale avisar.
    const typeMismatch = parent.type !== 'ambos' && kid.type !== 'ambos' && kid.type !== parent.type
    return (
      <div key={kid.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorOfMother(kid) }} />
        <span className="flex-1 min-w-0 text-[13px] text-slate-600 dark:text-slate-300 truncate">{kid.name}</span>
        {typeMismatch && (
          <span
            title="Esta subcategoria é de um tipo diferente da categoria em que está. Use Mover no menu ⋮."
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0"
          >
            <AlertTriangle className="h-2.5 w-2.5" /> fora do tipo
          </span>
        )}
        <span className="text-[11px] text-slate-400 shrink-0">{count} lançamento{count === 1 ? '' : 's'}</span>
        {renderActions(kid, true)}
      </div>
    )
  }

  // Linha de categoria no modelo da Análise: ícone redondo, nome, pilar e ⋮.
  // Sem valores — quanto se gasta em cada categoria é assunto da Análise;
  // aqui é onde se organiza.
  function renderParent(parent: Category, type: SectionType) {
    const kids = (childrenOf.get(parent.id) ?? [])
      // Uma mãe "Ambos" (o Outros) aparece nas duas seções; cada uma mostra
      // só as subcategorias do tipo dela.
      .filter(k => k.type === type || k.type === 'ambos')
      .filter(k => !q || matches(k) || matches(parent))
    // Buscando, abre sozinho para mostrar a subcategoria encontrada.
    const open = expanded.has(parent.id) || !!q
    const total = countOf(parent) + kids.reduce((sum, k) => sum + countOf(k), 0)
    // Lançamentos direto na mãe só viram linha quando ela tem subcategorias
    // (sem elas, já são os da própria categoria). "Outros" sempre mostra.
    const direct = txsByTypeName.get(`${type}|${parent.name.trim().toLowerCase()}`) ?? []
    const showDirect = direct.length > 0 && (kids.length > 0 || isOutros(parent))
    const color = parent.color
    return (
      <div key={`${type}:${parent.id}`} id={`cat-${type}-${parent.id}`} className="py-3 scroll-mt-20">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => toggle(parent.id)} aria-expanded={open}
            className="flex-1 min-w-0 flex items-center gap-3 text-left group">
            <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
            <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}1f`, color }}>
              <CategoryIcon iconKey={categoryIconKey(parent, categories)} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:underline">{parent.name}</span>
              <span className="block text-[11px] text-slate-400 truncate">
                {kids.length} subcategoria{kids.length === 1 ? '' : 's'} · {total} lançamento{total === 1 ? '' : 's'}
              </span>
            </span>
            {type === 'despesa' && (
              parent.bucket ? (
                <Badge className={cn('text-[10px] shrink-0 border-0', BUCKET_BADGE[parent.bucket])}>
                  {BUCKET_LABELS[parent.bucket]}
                </Badge>
              ) : !isOutros(parent) ? (
                <Badge className="text-[10px] shrink-0 border-0 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  sem pilar
                </Badge>
              ) : null
            )}
          </button>
          {renderActions(parent, false)}
        </div>

        {open && (
          <div className="mt-2 ml-[30px] pl-3 border-l-2 border-slate-100 dark:border-white/[0.08]">
            {showDirect && renderDirectRow(parent, type, direct)}
            {kids.map(kid => renderChild(kid, parent))}
            <button type="button" onClick={() => openCreate(parent.id)}
              className="mt-1 ml-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Nova subcategoria
            </button>
          </div>
        )}
      </div>
    )
  }

  // Mãe escolhida no formulário (subcategoria) e quem já usa cada cor.
  const formParent = form.parentId ? categories.find(c => c.id === form.parentId) ?? null : null
  const colorUsers = new Map<string, string[]>()
  for (const c of categories) {
    if (c.parent_id || (editing && c.id === editing.id)) continue
    const list = colorUsers.get(c.color) ?? []
    if (!list.includes(c.name)) list.push(c.name)
    colorUsers.set(c.color, list)
  }

  // ── Números da coluna da direita ──
  const outrosParent = parents.find(isOutros)
  const strandedKids = outrosParent ? (childrenOf.get(outrosParent.id) ?? []) : []
  const unlabeledList = parents.filter(p => !p.bucket && p.type !== 'receita' && !isOutros(p))
  // Só gasto de verdade: pagamento de fatura e Pix entre contas ficam em
  // "Outros" mas não somam, então não pedem revisão.
  const outrosDirect = outrosParent ? (txsByTypeName.get(`despesa|${outrosParent.name.trim().toLowerCase()}`) ?? []).filter(t => !isInternalMovement(t)) : []
  // Ordem alfabética, "Outros" sempre por último (como antes).
  const expenseParents = bySection.despesa
  const incomeList = bySection.receita
  const PILLARS: { key: CategoryBucket | 'none'; label: string; color: string }[] = [
    { key: 'essencial', label: 'Essencial', color: '#2563eb' },
    { key: 'estilo', label: 'Estilo de vida', color: '#db2777' },
    { key: 'futuro', label: 'Futuro', color: '#16a34a' },
    { key: 'none', label: 'Sem pilar', color: '#cbd5e1' },
  ]
  // Pilares por categoria: quantas (e quais) categorias de despesa em cada um.
  const allExpenseParents = parents.filter(p => (p.type === 'despesa' || p.type === 'ambos') && !isOutros(p))
  const pillarGroups = PILLARS.map(pl => ({
    ...pl,
    cats: allExpenseParents
      .filter(p => (p.bucket ?? 'none') === pl.key)
      .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')),
  }))
  const pillarCount = allExpenseParents.length

  function reviewOutros() {
    if (!outrosParent) return
    setSearch('')
    setExpanded(prev => new Set(prev).add(outrosParent.id))
    setOpenDirect(`despesa|${outrosParent.id}`)
    // Espera a lista abrir antes de rolar: com 50 ms a altura da página ainda
    // mudava enquanto ela abria e a rolagem parava no lugar errado (no topo).
    setTimeout(() => document.getElementById(`cat-despesa-${outrosParent.id}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 350)
  }

  // Vindo de outra tela com ?revisar=outros (ex.: "Revisar" em Regras), abre a
  // revisão de "Outros" direto, quando os lançamentos já carregaram.
  const reviewFromUrl = useRef(false)
  useEffect(() => {
    if (reviewFromUrl.current || !outrosParent || outrosDirect.length === 0) return
    if (new URLSearchParams(window.location.search).get('revisar') !== 'outros') return
    reviewFromUrl.current = true
    window.history.replaceState(null, '', window.location.pathname)
    reviewOutros()
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Categorias</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Como o app organiza cada lançamento — e o pilar 50/30/20 de cada categoria.
          </p>
        </div>
        {tab === 'categorias' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
              <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
              Restaurar padrões
            </Button>
            <Button size="sm" onClick={() => openCreate(null)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova categoria
            </Button>
          </div>
        )}
      </div>

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
            {t === 'categorias' ? 'Categorias' : `Eventos${events.events.length ? ` · ${events.events.length}` : ''}`}
          </button>
        ))}
      </div>

      {tab === 'categorias' ? (
        <>
          {seedError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              Erro ao restaurar: {seedError}
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
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
              <div className="space-y-4 min-w-0">
              {/* Despesas por categoria — mesmo modelo da Análise */}
              <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Despesas por categoria</h2>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">
                    Clique numa categoria para ver e criar subcategorias. Quanto você gasta em cada uma está na Análise.
                  </p>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Buscar categoria ou subcategoria..." value={search}
                      onChange={e => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  {expenseParents.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-10">
                      {q ? <>Nada encontrado para &ldquo;{search}&rdquo;</> : 'Nenhuma categoria de despesa.'}
                    </p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60">
                      {expenseParents.map(p => renderParent(p, 'despesa'))}
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {expenseParents.length} categoria{expenseParents.length === 1 ? '' : 's'} de despesa
                  </span>
                  <span className="text-xs text-slate-400">{expenseParents.reduce((sum, p) => sum + (childrenOf.get(p.id) ?? []).filter(k => k.type !== 'receita').length, 0)} subcategorias</span>
                </div>
              </section>

              {/* Receitas por categoria — mesmo card, embaixo das despesas */}
              <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 pb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                    <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Receitas por categoria</h2>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">
                    Categorias de entrada: salário, rendimentos, vendas…
                  </p>
                  {incomeList.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-8">{q ? 'Nada encontrado.' : 'Nenhuma categoria de receita.'}</p>
                  ) : (
                    <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60">
                      {incomeList.map(p => renderParent(p, 'receita'))}
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {incomeList.length} categoria{incomeList.length === 1 ? '' : 's'} de receita
                  </span>
                  <span className="text-xs text-slate-400">{incomeList.reduce((sum, p) => sum + (childrenOf.get(p.id) ?? []).filter(k => k.type !== 'despesa').length, 0)} subcategorias</span>
                </div>
              </section>
              </div>

              <div className="space-y-4 lg:sticky lg:top-6">
                {/* Vale organizar — o que falta arrumar, com botão */}
                {(unlabeledList.length > 0 || strandedKids.length > 0 || outrosDirect.length > 0) && (
                  <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vale organizar</h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 ml-6">
                      {[unlabeledList.length > 0, strandedKids.length > 0, outrosDirect.length > 0].filter(Boolean).length} ajuste(s) deixam relatórios e Planejamento mais certos
                    </p>
                    <ul className="mt-2 divide-y divide-amber-200/70 dark:divide-amber-800/40">
                      {unlabeledList.length > 0 && (
                        <li className="flex items-start gap-3 py-2.5">
                          <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{unlabeledList.length} categoria{unlabeledList.length === 1 ? '' : 's'} sem pilar</p>
                            <p className="mt-0.5 leading-relaxed">{unlabeledList.slice(0, 5).map(p => p.name).join(', ')}{unlabeledList.length > 5 ? '…' : ''} — fora do 50/30/20 do Planejamento.</p>
                          </div>
                          <button type="button" onClick={() => openEdit(unlabeledList[0])} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Definir</button>
                        </li>
                      )}
                      {strandedKids.length > 0 && (
                        <li className="flex items-start gap-3 py-2.5">
                          <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{strandedKids.length} subcategoria{strandedKids.length === 1 ? '' : 's'} dentro de &ldquo;Outros&rdquo;</p>
                            <p className="mt-0.5 leading-relaxed">{strandedKids.slice(0, 5).map(k => k.name).join(', ')}{strandedKids.length > 5 ? '…' : ''} — escolha a categoria certa.</p>
                          </div>
                          <button type="button" onClick={() => setMergeState({ from: strandedKids[0], toId: '', mode: 'mover' })} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Mover</button>
                        </li>
                      )}
                      {outrosDirect.length > 0 && (
                        <li className="flex items-start gap-3 py-2.5">
                          <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{outrosDirect.length} lançamento{outrosDirect.length === 1 ? '' : 's'} em &ldquo;Outros&rdquo;</p>
                            <p className="mt-0.5 leading-relaxed">Categorize por descrição e o app cria a regra para os próximos.</p>
                          </div>
                          <button type="button" onClick={reviewOutros} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Revisar</button>
                        </li>
                      )}
                    </ul>
                  </section>
                )}

                {/* Pilares 50/30/20 */}
                <OverviewSection icon={Compass} title="Pilares 50/30/20" subtitle="Suas categorias de despesa em cada pilar">
                  {pillarCount > 0 ? (
                    <>
                      <div className="flex h-3 rounded-full overflow-hidden mt-3 bg-slate-100 dark:bg-white/[0.08]">
                        {pillarGroups.map(pl => pl.cats.length > 0 && (
                          <div key={pl.key} title={`${pl.label}: ${pl.cats.length}`} style={{ width: `${(pl.cats.length / pillarCount) * 100}%`, backgroundColor: pl.color }} />
                        ))}
                      </div>
                      <ul className="mt-3 space-y-2.5">
                        {pillarGroups.map(pl => (
                          <li key={pl.key}>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: pl.color }} />
                              <span className={cn('flex-1 font-medium', pl.key === 'none' && pl.cats.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200')}>{pl.label}</span>
                              <span className="tabular-nums text-slate-400">{pl.cats.length} categoria{pl.cats.length === 1 ? '' : 's'}</span>
                            </div>
                            {pl.cats.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 ml-[18px]">
                                {pl.cats.map(c => (
                                  <button key={c.id} type="button" onClick={() => openEdit(c)} title="Editar (mudar o pilar)"
                                    className="text-[11px] rounded-full bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.1]">
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 mt-3">Nenhuma categoria de despesa ainda.</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-3">Clique numa categoria para mudar o pilar. É o pilar que monta o 50/30/20 do Planejamento.</p>
                </OverviewSection>

              </div>
            </div>
          )}
        </>
      ) : (
        /* ---------------- EVENTOS ---------------- */
        <EventsTab
          events={events.events}
          loading={events.loading}
          transactions={transactions}
          categories={categories}
          boards={boards}
          onNew={() => { setEditingEvent(null); setEventForm({ name: '', color: CATEGORY_COLORS[9] }); setEventError(''); setEventFormOpen(true) }}
          onEdit={ev => { setEditingEvent(ev); setEventForm({ name: ev.name, color: ev.color }); setEventError(''); setEventFormOpen(true) }}
          onDelete={ev => setEventDeleteTarget(ev)}
          onToggleClosed={ev => events.updateEvent(ev.id, { closed: !ev.closed })}
          onRemoveFromEvent={removeFromEvent}
          onAddToEvent={addToEvent}
        />
      )}

      <CategoriesHelp />

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
              {/* Sem "Ambos": ele virava saco de gato, misturando entrada e
                  saída na mesma categoria. O mesmo NOME pode existir nos dois
                  tipos (ex.: "Trabalho" de receita e de despesa) — o lançamento
                  cai na certa sozinho, porque ele já sabe se é entrada ou saída. */}
              <Select
                value={form.type}
                onValueChange={v => v && setForm(f => ({ ...f, type: v as CategoryType }))}
                items={[
                  { value: 'despesa', label: 'Despesa' },
                  { value: 'receita', label: 'Receita' },
                  ...(form.type === 'ambos' ? [{ value: 'ambos', label: 'Ambos (antigo)' }] : []),
                ]}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  {form.type === 'ambos' && <SelectItem value="ambos">Ambos (antigo)</SelectItem>}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                O mesmo nome pode existir nos dois tipos — &ldquo;Trabalho&rdquo; de entrada e de saída são
                categorias diferentes, e cada lançamento cai na certa sozinho.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Etiqueta 50/30/20</Label>
              <Select
                items={[
                  { value: NO_BUCKET, label: 'Nenhuma' },
                  { value: 'essencial', label: 'Essencial' },
                  { value: 'estilo', label: 'Estilo de vida' },
                  { value: 'futuro', label: 'Futuro' },
                ]}
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

            {formParent ? (
              // Subcategoria não escolhe cor nem ícone: usa os da mãe.
              <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-white/[0.04] px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: formParent.color + '25' }}>
                  <RowIcon iconKey={categoryIconKey(formParent, categories)} color={formParent.color} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Usa a cor e o ícone de <strong className="text-slate-700 dark:text-slate-200">{formParent.name}</strong>.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <div className="grid grid-cols-10 gap-1.5 pt-1">
                    {CATEGORY_ICONS.map(({ key, label, Icon }) => {
                      const selected = (form.icon ?? guessIconKey(form.name)) === key
                      return (
                        <button key={key} type="button" title={label} aria-label={label} aria-pressed={selected}
                          onClick={() => setForm(f => ({ ...f, icon: key }))}
                          className={cn(
                            'h-7 w-7 rounded-lg flex items-center justify-center border transition-colors',
                            selected ? 'border-transparent' : 'border-slate-200 dark:border-white/[0.08] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
                          )}
                          style={selected ? { backgroundColor: form.color + '25', color: form.color, boxShadow: `inset 0 0 0 1.5px ${form.color}` } : undefined}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CATEGORY_COLORS.map(color => {
                      const users = colorUsers.get(color) ?? []
                      return (
                        <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                          title={users.length ? `Já usada por: ${users.join(', ')}` : 'Livre'}
                          className="relative h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: form.color === color ? '#1e293b' : 'transparent',
                            outline: form.color === color ? '2px solid white' : 'none', outlineOffset: '-3px',
                          }}>
                          {users.length > 0 && (
                            <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-white dark:bg-slate-900 text-[9px] font-bold leading-[14px] text-slate-600 dark:text-slate-300 shadow">
                              {users.length}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {(colorUsers.get(form.color) ?? []).length > 0
                      ? <>Essa cor já é usada por: {(colorUsers.get(form.color) ?? []).join(', ')}.</>
                      : 'Nenhuma outra categoria usa essa cor.'}
                    {' '}As subcategorias ficam com a mesma cor.
                  </p>
                </div>
              </>
            )}

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
            {deleteHasTwin && (
              <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl p-3">
                <AlertTriangle className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Existe outra categoria com o mesmo nome, então <strong>nenhum lançamento é movido</strong>:
                  eles continuam apontando para esse nome e passam a usar a categoria que ficar.
                </p>
              </div>
            )}

            {!deleteHasTwin && (deleteCount > 0 || deleteKids > 0) && (
              <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Atenção</p>
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
                    Dica: a seta (→) move a categoria para dentro de outra sem mexer nos lançamentos.
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
          <DialogHeader>
            <DialogTitle>
              {mergeState?.mode === 'juntar' ? 'Juntar categorias' : 'Mover categoria'}
            </DialogTitle>
          </DialogHeader>
          {mergeState && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {mergeState.mode === 'juntar' ? (
                  <>
                    Os {mergeCount} lançamentos de <strong className="text-slate-700 dark:text-slate-200">&ldquo;{mergeState.from.name}&rdquo;</strong> passam
                    a ficar na categoria escolhida, e &ldquo;{mergeState.from.name}&rdquo; deixa de existir.
                  </>
                ) : (
                  <>
                    <strong className="text-slate-700 dark:text-slate-200">&ldquo;{mergeState.from.name}&rdquo;</strong> vira
                    subcategoria da categoria escolhida. O nome continua o mesmo e
                    <strong> nenhum lançamento é alterado</strong>.
                  </>
                )}
              </p>

              <div className="space-y-2">
                <Label>{mergeState.mode === 'juntar' ? 'Categoria destino' : 'Mover para dentro de'}</Label>
                <Select
                  value={mergeState.toId}
                  onValueChange={v => v && setMergeState(st => st ? { ...st, toId: v } : null)}
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

              {mergeState.mode === 'juntar' && (
                <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-300">
                    <strong>Isso não tem desfazer.</strong> Depois de juntar, não existe mais como saber
                    quais lançamentos eram de &ldquo;{mergeState.from.name}&rdquo; e quais já estavam no destino.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setMergeState(null)} className="flex-1">Cancelar</Button>
                {mergeState.mode === 'juntar' ? (
                  <Button variant="destructive" onClick={confirmMerge} disabled={!mergeState.toId || merging} className="flex-1">
                    {merging ? 'Juntando...' : 'Juntar mesmo assim'}
                  </Button>
                ) : (
                  <Button onClick={confirmMove} disabled={!mergeState.toId || merging} className="flex-1">
                    {merging ? 'Movendo...' : 'Mover'}
                  </Button>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-slate-400 dark:text-slate-500 hover:underline"
                onClick={() => setMergeState(st => st ? { ...st, toId: '', mode: st.mode === 'juntar' ? 'mover' : 'juntar' } : null)}
              >
                {mergeState.mode === 'juntar'
                  ? '← Só mover para dentro de outra categoria'
                  : 'Na verdade quero juntar esta categoria com outra (os lançamentos passam para lá) →'}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SEPARAR "AMBOS" EM DESPESA + RECEITA */}
      <Dialog open={!!splitState} onOpenChange={v => { if (!v) setSplitState(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Separar em despesa e receita</DialogTitle></DialogHeader>
          {splitState && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-200">&ldquo;{splitState.cat.name}&rdquo;</strong> vira
                duas categorias com o mesmo nome: uma de <strong>despesa</strong>, que fica onde está, e uma
                de <strong>receita</strong>. Os lançamentos se dividem sozinhos pelo tipo de cada um —
                <strong> nenhum é alterado</strong>.
              </p>

              <div className="space-y-2">
                <Label>A parte de receita vai para dentro de</Label>
                <Select
                  value={splitState.parentId ?? NO_PARENT}
                  onValueChange={v => { if (v) setSplitState(st => st ? { ...st, parentId: v === NO_PARENT ? null : v } : null) }}
                  items={[
                    { value: NO_PARENT, label: 'Nenhuma (categoria principal)' },
                    ...incomeParents.map(p => ({ value: p.id, label: p.name })),
                  ]}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>Nenhuma (categoria principal)</SelectItem>
                    {incomeParents.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Só categorias principais de receita: a metade de receita não cabe dentro de uma
                  categoria de despesa.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setSplitState(null)} className="flex-1">Cancelar</Button>
                <Button onClick={confirmSplit} disabled={splitting === splitState.cat.id} className="flex-1">
                  {splitting === splitState.cat.id ? 'Separando...' : 'Separar'}
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
