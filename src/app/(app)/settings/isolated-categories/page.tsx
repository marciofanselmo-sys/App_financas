'use client'

import { useState, useMemo } from 'react'
import { useCategories } from '@/hooks/use-categories'
import { useTransactions } from '@/hooks/use-transactions'
import { Category, CategoryType, CATEGORY_COLORS, TRANSFER_CATEGORY_COLOR, SpecialCategoryDate } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { InfoBox } from '@/components/ui/info-box'
import { SpecialDatesPicker, MONTH_NAMES } from '@/components/categories/special-dates-picker'
import { Plus, Pencil, Trash2, Sparkles, AlertTriangle, ArrowRight, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<CategoryType, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  transferencia: 'Transferência',
  ambos: 'Ambos',
}

const TYPE_BADGE: Record<CategoryType, string> = {
  receita: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  despesa: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  transferencia: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
  ambos:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

// Mesma convenção visual das abas Categorias e Subcategorias: seções por tipo, transferência por último.
type SectionType = 'despesa' | 'receita' | 'transferencia'
const SECTION_ORDER: SectionType[] = ['despesa', 'receita', 'transferencia']

const SECTION_META: Record<SectionType, { label: string; icon: React.ElementType; iconColor: string; iconBg: string }> = {
  despesa:       { label: 'Despesas',       icon: TrendingDown,   iconColor: 'text-red-500',   iconBg: 'bg-red-50 dark:bg-red-900/20' },
  receita:       { label: 'Receitas',       icon: TrendingUp,     iconColor: 'text-green-500', iconBg: 'bg-green-50 dark:bg-green-900/20' },
  transferencia: { label: 'Transferências', icon: ArrowLeftRight, iconColor: 'text-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-700' },
}

interface FormState {
  name: string
  type: CategoryType
  color: string
  specialDates: SpecialCategoryDate[]
}

interface MergeState {
  from: Category
  toId: string
}

function emptyForm(): FormState {
  const today = new Date()
  return { name: '', type: 'despesa', color: CATEGORY_COLORS[0], specialDates: [{ month: today.getMonth() + 1, year: today.getFullYear() }] }
}

export default function IsolatedCategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const { transactions } = useTransactions()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [mergeState, setMergeState] = useState<MergeState | null>(null)
  const [merging, setMerging] = useState(false)

  const usageCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      if (t.category) map[t.category] = (map[t.category] ?? 0) + 1
    }
    return map
  }, [transactions])

  const isolatedCategories = useMemo(
    () => categories
      .filter(c => c.special_dates && c.special_dates.length > 0)
      .sort((a, b) => {
        const aMin = a.special_dates![0]
        const bMin = b.special_dates![0]
        return (bMin.year - aMin.year) || (bMin.month - aMin.month)
      }),
    [categories],
  )

  const bySection: Record<SectionType, Category[]> = {
    despesa: isolatedCategories.filter(c => c.type === 'despesa' || c.type === 'ambos'),
    receita: isolatedCategories.filter(c => c.type === 'receita' || c.type === 'ambos'),
    transferencia: isolatedCategories.filter(c => c.type === 'transferencia' || c.type === 'ambos'),
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color, specialDates: cat.special_dates ?? [] })
    setFormError('')
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Nome obrigatório.'); return }
    if (form.specialDates.length === 0) { setFormError('Adicione pelo menos um mês.'); return }
    setSaving(true); setFormError('')
    const payload = {
      name: form.name,
      type: form.type,
      color: form.type === 'transferencia' ? TRANSFER_CATEGORY_COLOR : form.color,
      special_dates: form.specialDates,
    }
    const { error } = editing
      ? await updateCategory(editing.id, payload)
      : await createCategory(payload)
    if (error) {
      setFormError(error.includes('unique') || error.includes('duplicate') || error.includes('nome')
        ? 'Já existe uma categoria com esse nome.' : `Erro: ${error}`)
    } else {
      setFormOpen(false)
    }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const { error } = await deleteCategory(deleteTarget.id)
    setDeleting(false)
    if (error) { setDeleteError(error); return }
    setDeleteTarget(null)
  }

  async function confirmMerge() {
    if (!mergeState || !mergeState.toId) return
    const target = categories.find(c => c.id === mergeState.toId)
    if (!target) return
    setMerging(true)
    await updateCategory(mergeState.from.id, { name: target.name })
    await deleteCategory(mergeState.from.id)
    setMergeState(null)
    setMerging(false)
  }

  const deleteCount = deleteTarget ? (usageCount[deleteTarget.name] ?? 0) : 0
  const mergeTargets = mergeState
    ? isolatedCategories.filter(c => c.id !== mergeState.from.id && c.type === mergeState.from.type)
    : []

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Categorias isoladas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isolatedCategories.length} categoria{isolatedCategories.length !== 1 ? 's' : ''} isolada{isolatedCategories.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2 bg-violet-600 hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Nova isolada
        </Button>
      </div>

      {/* Explicação */}
      <InfoBox id="isolated-categories-como-funciona" title="O que são Categorias isoladas?" color="violet">
        <p className="text-violet-600 dark:text-violet-400 leading-relaxed">
          Categorias isoladas servem para organizar um gasto ou evento único de um mês específico — por exemplo <strong>&ldquo;Reforma Banheiro&rdquo;</strong> ou <strong>&ldquo;Viagem&rdquo;</strong>. Diferente de uma categoria normal, elas só ficam disponíveis para categorizar transações nos meses escolhidos.
        </p>
        <p className="text-violet-600 dark:text-violet-400 leading-relaxed">
          <strong>Uma categoria, várias datas.</strong> Não precisa criar uma nova a cada mês — a mesma categoria pode valer para vários meses, bastando adicionar mais datas depois, editando-a.
        </p>
        <div className="border-t border-violet-200 dark:border-violet-700/50 pt-2.5">
          <p className="font-semibold mb-1">Nunca entram no sistema de regras</p>
          <p className="text-violet-600 dark:text-violet-400">
            Uma vez que uma transação está numa categoria isolada, ela só muda por edição manual — nunca é sobrescrita por uma regra automática, nem cria uma sozinha.
          </p>
        </div>
      </InfoBox>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isolatedCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="h-12 w-12 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-violet-400" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria isolada criada ainda</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
            Crie uma para organizar um gasto ou evento único de um mês específico.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTION_ORDER.map(type => {
            const items = bySection[type]
            if (items.length === 0) return null
            const { label, icon: Icon, iconColor, iconBg } = SECTION_META[type]
            return (
              <section key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconBg)}>
                    <Icon className={cn('h-4 w-4', iconColor)} />
                  </div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{label}</h2>
                  <span className="text-xs text-slate-400">({items.length})</span>
                </div>

                <div className="space-y-2">
                  {items.map(cat => {
                    const count = usageCount[cat.name] ?? 0
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-violet-100 dark:border-violet-900/40"
                      >
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '25' }}>
                          <Sparkles className="h-4 w-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{cat.name}</p>
                          <p className="text-xs text-violet-500 dark:text-violet-400 mt-0.5">
                            {cat.special_dates!.map(d => `${MONTH_NAMES[d.month - 1]}/${d.year}`).join(', ')}
                            {count > 0 && ` · ${count} transaç${count === 1 ? 'ão' : 'ões'}`}
                          </p>
                        </div>
                        <Badge className={`text-xs shrink-0 border-0 ${TYPE_BADGE[cat.type]}`}>
                          {TYPE_LABELS[cat.type]}
                        </Badge>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Mesclar com outra categoria isolada"
                            onClick={() => setMergeState({ from: cat, toId: '' })}
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setDeleteError(''); setDeleteTarget(cat) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoria isolada' : 'Nova categoria isolada'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {formError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input id="cat-name" placeholder="Ex: Reforma Banheiro, Viagem..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={v => setForm(f => ({
                  ...f,
                  type: v as CategoryType,
                  color: v === 'transferencia' ? TRANSFER_CATEGORY_COLOR : f.color,
                }))}
                items={TYPE_LABELS}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === 'transferencia' ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Categorias de transferência usam sempre a cor cinza padrão, a mesma já usada pra representar transferência no resto do app.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {CATEGORY_COLORS.map(color => (
                    <button key={color} type="button" onClick={() => setForm(f => ({ ...f, color }))}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: color, borderColor: form.color === color ? '#1e293b' : 'transparent', outline: form.color === color ? '2px solid white' : 'none', outlineOffset: '-3px' }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1.5">
              <Label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Meses em que vale
              </Label>
              <SpecialDatesPicker
                dates={form.specialDates}
                onChange={d => setForm(f => ({ ...f, specialDates: d }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM — com contagem de uso */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir categoria isolada</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tem certeza que deseja excluir <strong className="text-slate-700 dark:text-slate-200">&ldquo;{deleteTarget?.name}&rdquo;</strong>?
            </p>
            {deleteCount > 0 && (
              <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">Atenção</p>
                  <p className="mt-0.5">
                    {deleteCount} transaç{deleteCount === 1 ? 'ão usa' : 'ões usam'} essa categoria. Elas serão movidas automaticamente para &ldquo;Outros&rdquo;, junto com regras de categorização e limites de planejamento que apontam pra ela.
                  </p>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Dica: use &ldquo;Mesclar&rdquo; (→) se quiser mover pra uma categoria isolada específica em vez de &ldquo;Outros&rdquo;.
                  </p>
                </div>
              </div>
            )}
            {deleteError && (
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Excluindo...' : deleteCount > 0 ? `Excluir mesmo assim` : 'Excluir'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MERGE MODAL */}
      <Dialog open={!!mergeState} onOpenChange={v => { if (!v) setMergeState(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Mesclar categoria isolada</DialogTitle></DialogHeader>
          {mergeState && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todas as transações de <strong className="text-slate-700 dark:text-slate-200">&ldquo;{mergeState.from.name}&rdquo;</strong> serão
                movidas para a categoria destino, e &ldquo;{mergeState.from.name}&rdquo; será excluída.
              </p>
              {(usageCount[mergeState.from.name] ?? 0) > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-lg px-3 py-2">
                  {usageCount[mergeState.from.name]} transaç{usageCount[mergeState.from.name] === 1 ? 'ão será movida' : 'ões serão movidas'} para a nova categoria.
                </p>
              )}
              <div className="space-y-2">
                <Label>Categoria isolada destino</Label>
                <Select
                  value={mergeState.toId}
                  onValueChange={v => { if (v) setMergeState(s => s ? { ...s, toId: v } : null) }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a categoria destino..." /></SelectTrigger>
                  <SelectContent>
                    {mergeTargets.length === 0 ? (
                      <SelectItem value="__empty__" disabled>Nenhuma categoria isolada disponível</SelectItem>
                    ) : (
                      mergeTargets.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
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
    </div>
  )
}
