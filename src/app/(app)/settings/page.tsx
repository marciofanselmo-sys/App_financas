'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/use-categories'
import { Category, CategoryType, CATEGORY_COLORS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Tag, RotateCcw } from 'lucide-react'

const TYPE_LABELS: Record<CategoryType, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  ambos: 'Ambos',
}

const TYPE_BADGE: Record<CategoryType, string> = {
  receita: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  despesa: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ambos:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

interface FormState {
  name: string
  type: CategoryType
  color: string
}

const EMPTY_FORM: FormState = { name: '', type: 'despesa', color: CATEGORY_COLORS[0] }

export default function SettingsPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory, seedDefaults } = useCategories()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedError, setSeedError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color })
    setFormError('')
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Nome obrigatório.'); return }
    setSaving(true)
    setFormError('')

    const { error } = editing
      ? await updateCategory(editing.id, form)
      : await createCategory(form)

    if (error) {
      setFormError(
        error.includes('unique') || error.includes('duplicate')
          ? 'Já existe uma categoria com esse nome.'
          : `Erro: ${error}`
      )
    } else {
      setFormOpen(false)
    }
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteCategory(deleteTarget.id)
    setDeleteTarget(null)
    setDeleting(false)
  }

  async function handleSeedDefaults() {
    setSeeding(true)
    setSeedError('')
    const { error } = await seedDefaults()
    if (error) setSeedError(error)
    setSeeding(false)
  }

  const receitas = categories.filter(c => c.type === 'receita' || c.type === 'ambos')
  const despesas = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Configurações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie as preferências do app</p>
      </div>

      {/* SEÇÃO: CATEGORIAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Categorias</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categorias cadastradas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={seeding} className="gap-2">
              <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
              Restaurar padrões
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova categoria
            </Button>
          </div>
        </div>

        {seedError && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
            Erro ao restaurar: {seedError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Tag className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <div>
              <p className="font-medium text-slate-600 dark:text-slate-300">Nenhuma categoria encontrada</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Crie uma nova ou restaure as padrão</p>
            </div>
            <Button onClick={handleSeedDefaults} disabled={seeding} variant="outline" className="gap-2">
              <RotateCcw className={`h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Restaurando...' : 'Restaurar categorias padrão'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {[
              { label: 'Receitas', items: receitas },
              { label: 'Despesas', items: despesas },
            ].map(({ label, items }) => (
              <div key={label}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">{label}</h3>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Nenhuma categoria de {label.toLowerCase()}</p>
                ) : (
                  <div className="space-y-2">
                    {items.map(cat => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color + '25' }}>
                          <Tag className="h-4 w-4" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{cat.name}</p>
                        </div>
                        <Badge className={`text-xs shrink-0 border-0 ${TYPE_BADGE[cat.type]}`}>
                          {TYPE_LABELS[cat.type]}
                        </Badge>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setDeleteTarget(cat)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
              <Input
                id="cat-name"
                placeholder="Ex: Streaming, Pet, Investimento..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CategoryType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#1e293b' : 'transparent',
                      outline: form.color === color ? '2px solid white' : 'none',
                      outlineOffset: '-3px',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir <strong>"{deleteTarget?.name}"</strong>? As transações com essa categoria não serão afetadas.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting} className="flex-1">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
