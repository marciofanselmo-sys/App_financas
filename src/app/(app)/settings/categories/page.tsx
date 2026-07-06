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
import { SpecialDatesPicker, MONTH_NAMES } from '@/components/categories/special-dates-picker'
import { Plus, Pencil, Trash2, Tag, RotateCcw, Search, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react'

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

const TYPE_FILTER: { value: string; label: string }[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'ambos',   label: 'Ambos' },
]

interface FormState {
  name: string
  type: CategoryType
  color: string
  special: boolean
  specialDates: SpecialCategoryDate[]
}

interface MergeState {
  from: Category
  toId: string   // empty string = not selected
}

const EMPTY_FORM: FormState = {
  name: '', type: 'despesa', color: CATEGORY_COLORS[0],
  special: false, specialDates: [],
}

export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory, seedDefaults } = useCategories()
  const { transactions } = useTransactions()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('todos')
  const [mergeState, setMergeState] = useState<MergeState | null>(null)
  const [merging, setMerging] = useState(false)

  // Count transactions per category
  const usageCount = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      if (t.category) map[t.category] = (map[t.category] ?? 0) + 1
    }
    return map
  }, [transactions])

  const filtered = useMemo(() => {
    let result = categories.filter(c => !(c.special_dates && c.special_dates.length > 0))
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }
    if (typeFilter !== 'todos') {
      result = result.filter(c => c.type === typeFilter)
    }
    return result
  }, [categories, search, typeFilter])

  const receitas = filtered.filter(c => c.type === 'receita' || c.type === 'ambos')
  const despesas = filtered.filter(c => c.type === 'despesa' || c.type === 'ambos')
  const transferencias = filtered.filter(c => c.type === 'transferencia' || c.type === 'ambos')

  const specialCategories = useMemo(
    () => categories
      .filter(c => c.special_dates && c.special_dates.length > 0)
      .sort((a, b) => {
        const aMin = a.special_dates![0]
        const bMin = b.special_dates![0]
        return (bMin.year - aMin.year) || (bMin.month - aMin.month)
      }),
    [categories],
  )

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true)
  }

  function openCreateSpecial() {
    const today = new Date()
    setEditing(null)
    setForm({ ...EMPTY_FORM, special: true, specialDates: [{ month: today.getMonth() + 1, year: today.getFullYear() }] })
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({
      name: cat.name, type: cat.type, color: cat.color,
      special: !!(cat.special_dates && cat.special_dates.length > 0),
      specialDates: cat.special_dates ?? [],
    })
    setFormError(''); setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Nome obrigatório.'); return }
    if (form.special && form.specialDates.length === 0) { setFormError('Adicione pelo menos um mês para a categoria especial.'); return }
    setSaving(true); setFormError('')
    const payload = {
      name: form.name,
      type: form.type,
      color: form.type === 'transferencia' ? TRANSFER_CATEGORY_COLOR : form.color,
      special_dates: form.special ? form.specialDates : [],
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

  async function handleSeedDefaults() {
    setSeeding(true); setSeedError('')
    const { error } = await seedDefaults()
    if (error) setSeedError(error)
    setSeeding(false)
  }

  const deleteCount = deleteTarget ? (usageCount[deleteTarget.name] ?? 0) : 0
  const mergeTargets = mergeState
    ? categories.filter(c => c.id !== mergeState.from.id && c.type === mergeState.from.type)
    : []

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categorias cadastradas</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
            <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
            Restaurar padrões
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        </div>
      </div>

      {seedError && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
          Erro ao restaurar: {seedError}
        </div>
      )}

      {/* Busca + filtro */}
      {categories.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'todos')}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_FILTER.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Tag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria encontrada</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Crie uma nova ou restaure as categorias padrão</p>
          </div>
          <Button onClick={handleSeedDefaults} disabled={seeding} variant="outline" className="gap-2">
            <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'Restaurando...' : 'Restaurar categorias padrão'}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">Nenhuma categoria para &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="space-y-6">
          {[
            { label: 'Receitas', items: receitas, help: 'Dinheiro que entra: salário, freelance, vendas... Conta como ganho real no saldo, no dashboard e nos relatórios.' },
            { label: 'Despesas', items: despesas, help: 'Dinheiro que sai de verdade: contas, compras, assinaturas... Conta como gasto real no saldo, no planejamento e nos relatórios.' },
            { label: 'Transferências', items: transferencias, help: 'Movimentação entre suas próprias contas — não é ganho nem gasto real (ex: pagar a fatura do cartão pela conta corrente, ou aplicar num investimento). Por isso fica fora dos totais de receita/despesa: o gasto de verdade já foi contado individualmente na fatura, por exemplo, e somar a transferência também duplicaria o valor. Categorizar ajuda só a organizar pra onde o dinheiro foi.' },
          ].map(({ label, items, help }) => (
            <div key={label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{label}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{help}</p>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Nenhuma categoria de {label.toLowerCase()}</p>
              ) : (
                <div className="space-y-2">
                  {items.map(cat => {
                    const count = usageCount[cat.name] ?? 0
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '25' }}>
                          <Tag className="h-4 w-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{cat.name}</p>
                          {count > 0 && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {count} transaç{count === 1 ? 'ão' : 'ões'}
                            </p>
                          )}
                        </div>
                        <Badge className={`text-xs shrink-0 border-0 ${TYPE_BADGE[cat.type]}`}>
                          {TYPE_LABELS[cat.type]}
                        </Badge>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title="Mesclar com outra categoria"
                            onClick={() => setMergeState({ from: cat, toId: '' })}
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          {cat.name.toLowerCase() !== 'outros' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => { setDeleteError(''); setDeleteTarget(cat) }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CATEGORIAS ESPECIAIS — separadas da lista principal, presas a um mês/ano */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Categorias especiais
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Para organizar um gasto ou evento único de um mês específico (ex: &ldquo;Reforma Banheiro&rdquo;, &ldquo;Viagem&rdquo;)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={openCreateSpecial} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nova especial
          </Button>
        </div>

        {specialCategories.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Nenhuma categoria especial criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {specialCategories.map(cat => {
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
        )}
      </div>

      {/* FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {formError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input id="cat-name" placeholder="Ex: Streaming, Pet, Investimento..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
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
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
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

            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, special: !f.special }))}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                <span className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${form.special ? 'bg-violet-500 justify-end' : 'bg-slate-200 dark:bg-slate-600 justify-start'}`}>
                  <span className="h-4 w-4 rounded-full bg-white shadow" />
                </span>
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Categoria especial (só vale em meses específicos)
              </button>

              {form.special && (
                <div className="pt-1 space-y-1.5">
                  <SpecialDatesPicker
                    dates={form.specialDates}
                    onChange={d => setForm(f => ({ ...f, specialDates: d }))}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Não aparece na lista principal — fica na seção &ldquo;Categorias especiais&rdquo; no final da página. Você pode adicionar mais meses depois, editando a categoria.
                  </p>
                </div>
              )}
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
          <DialogHeader><DialogTitle>Excluir categoria</DialogTitle></DialogHeader>
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
                    Dica: use &ldquo;Mesclar&rdquo; (→) se quiser mover pra uma categoria específica em vez de &ldquo;Outros&rdquo;.
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
          <DialogHeader><DialogTitle>Mesclar categoria</DialogTitle></DialogHeader>
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
                <Label>Categoria destino</Label>
                <Select value={mergeState.toId} onValueChange={v => setMergeState(s => s ? { ...s, toId: v ?? '' } : null)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a categoria destino..." /></SelectTrigger>
                  <SelectContent>
                    {mergeTargets.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
    </div>
  )
}
