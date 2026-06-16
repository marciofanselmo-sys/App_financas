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
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'

const TYPE_LABELS: Record<CategoryType, string> = {
  receita: 'Receita',
  despesa: 'Despesa',
  ambos: 'Ambos',
}

const TYPE_COLORS: Record<CategoryType, string> = {
  receita: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  despesa: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  ambos: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

interface FormState {
  name: string
  type: CategoryType
  color: string
}

const EMPTY_FORM: FormState = { name: '', type: 'despesa', color: CATEGORY_COLORS[0] }

export default function CategoriesPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setFormOpen(true)
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({ name: cat.name, type: cat.type, color: cat.color })
    setError('')
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome obrigatório.'); return }
    setSaving(true)
    setError('')

    const { error } = editing
      ? await updateCategory(editing.id, form)
      : await createCategory(form)

    if (error) {
      setError('Esse nome já existe ou ocorreu um erro.')
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

  const receitas = categories.filter(c => c.type === 'receita' || c.type === 'ambos')
  const despesas = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Categorias</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{categories.length} categorias cadastradas</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { label: 'Receitas', items: receitas },
            { label: 'Despesas', items: despesas },
          ].map(({ label, items }) => (
            <div key={label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">{label}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">Nenhuma categoria de {label.toLowerCase()}</p>
              ) : (
                <div className="space-y-2">
                  {items.map(cat => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                    >
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + '25' }}
                      >
                        <Tag className="h-4 w-4" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{cat.name}</p>
                      </div>
                      <Badge className={`text-xs shrink-0 ${TYPE_COLORS[cat.type]}`} variant="outline">
                        {TYPE_LABELS[cat.type]}
                      </Badge>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                          <Pencil className="h-3.5 w-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setDeleteTarget(cat)}
                        >
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

      {/* FORM MODAL */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Streaming, Pet, Investimento..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CategoryType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: form.color === color ? '#1e293b' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
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
