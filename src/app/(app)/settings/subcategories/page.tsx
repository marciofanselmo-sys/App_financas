'use client'

import { useState } from 'react'
import { useSubcategories } from '@/hooks/use-subcategories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Layers, Info, RefreshCw } from 'lucide-react'

export default function SubcategoriesPage() {
  const { subcategories, loading, createSubcategory, renameSubcategory, deleteSubcategory } = useSubcategories()

  const [newName, setNewName]           = useState('')
  const [adding, setAdding]             = useState(false)
  const [addError, setAddError]         = useState('')
  const [editing, setEditing]           = useState<string | null>(null)
  const [editValue, setEditValue]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setAddError('')
    const ok = await createSubcategory(newName.trim())
    if (!ok) setAddError('Erro ao criar subcategoria. Tente novamente.')
    else setNewName('')
    setAdding(false)
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || !editValue.trim() || editValue.trim() === editing) { setEditing(null); return }
    setSaving(true)
    await renameSubcategory(editing, editValue.trim())
    setSaving(false)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteSubcategory(deleteTarget)
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Subcategorias</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {subcategories.length} subcategoria{subcategories.length !== 1 ? 's' : ''} criada{subcategories.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Explicação */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-violet-800 dark:text-violet-300">O que são Subcategorias?</p>
            <p className="text-violet-700 dark:text-violet-400 leading-relaxed">
              Subcategorias são etiquetas exclusivas da aba <strong>Recorrências</strong>. Elas servem para <strong>agrupar cobranças com nomes diferentes no extrato que representam o mesmo gasto fixo</strong>.
            </p>
            <p className="text-violet-700 dark:text-violet-400 leading-relaxed">
              Muitos gastos recorrentes chegam com descrições que variam mês a mês — como o Pix do aluguel que pode vir como{' '}
              <span className="font-mono bg-violet-100 dark:bg-violet-900/50 px-1 rounded text-xs">FERNANDO AUGUSTO FERREIRA</span>{' '}
              ou{' '}
              <span className="font-mono bg-violet-100 dark:bg-violet-900/50 px-1 rounded text-xs">Pix GRUPO HOUMAX</span>.
              {' '}Sem agrupamento, aparecem como itens separados. Com a subcategoria <strong>Aluguel</strong> aplicada aos dois, viram um único card com a contagem e a média corretas.
            </p>
            <p className="text-violet-700 dark:text-violet-400 leading-relaxed">
              <strong>É diferente de Categoria?</strong> Sim. Categorias (Moradia, Alimentação...) classificam todas as transações e aparecem em todo o app. Subcategorias são um agrupador que existe só dentro de Recorrências.
            </p>
            <div className="flex items-start gap-2 pt-1 border-t border-violet-200 dark:border-violet-700/50">
              <Layers className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-600 dark:text-violet-400">
                <strong>Como usar:</strong> em Recorrências, clique em <strong>+ subcat.</strong> em qualquer card e escolha a subcategoria criada aqui.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Criar nova */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Nova subcategoria</p>
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Ex: Aluguel, Streaming, Academia..."
            value={newName}
            onChange={e => { setNewName(e.target.value); setAddError('') }}
            className="flex-1"
          />
          <Button type="submit" disabled={!newName.trim() || adding} className="gap-2 bg-violet-600 hover:bg-violet-700">
            {adding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Criar</>}
          </Button>
        </form>
        {addError && <p className="text-xs text-red-500 mt-1">{addError}</p>}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : subcategories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="h-12 w-12 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
            <Layers className="h-6 w-6 text-violet-400" />
          </div>
          <p className="font-medium text-slate-600 dark:text-slate-300">Nenhuma subcategoria ainda</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
            Crie subcategorias acima e depois atribua-as nos cards da aba Recorrências.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {subcategories.map(s => (
            <div
              key={s}
              className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group"
            >
              {editing === s ? (
                <form onSubmit={handleRename} className="flex items-center gap-2 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-violet-500" />
                  </div>
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditing(null) }}
                    className="flex-1 h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700" disabled={saving}>
                    {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Salvar'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-violet-500" />
                  </div>
                  <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{s}</p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => { setEditing(s); setEditValue(s) }}>
                      <Pencil className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir subcategoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir <strong>&ldquo;{deleteTarget}&rdquo;</strong>? Todos os cards de Recorrências com essa subcategoria serão desagrupados.
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
