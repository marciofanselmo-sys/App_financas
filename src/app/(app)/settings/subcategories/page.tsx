'use client'

import { useState, useMemo } from 'react'
import { useSubcategories } from '@/hooks/use-subcategories'
import { useCategories } from '@/hooks/use-categories'
import { Subcategory, TransactionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Layers, RefreshCw, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { InfoBox } from '@/components/ui/info-box'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
  { value: 'transferencia', label: 'Transferência' },
]

// Transferência fica sempre por último, mesma convenção do resto do app.
const SECTION_ORDER: TransactionType[] = ['despesa', 'receita', 'transferencia']

const SECTION_META: Record<TransactionType, { label: string; icon: React.ElementType; iconColor: string; iconBg: string }> = {
  despesa:       { label: 'Despesas',       icon: TrendingDown,   iconColor: 'text-red-500',   iconBg: 'bg-red-50 dark:bg-red-900/20' },
  receita:       { label: 'Receitas',       icon: TrendingUp,     iconColor: 'text-green-500', iconBg: 'bg-green-50 dark:bg-green-900/20' },
  transferencia: { label: 'Transferências', icon: ArrowLeftRight, iconColor: 'text-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-700' },
}

export default function SubcategoriesPage() {
  const { subcategories, loading, createSubcategory, renameSubcategory, deleteSubcategory } = useSubcategories()
  const { categories } = useCategories()

  const [newName, setNewName]           = useState('')
  const [newType, setNewType]           = useState<TransactionType>('despesa')
  const [adding, setAdding]             = useState(false)
  const [addError, setAddError]         = useState('')
  const [editing, setEditing]           = useState<Subcategory | null>(null)
  const [editValue, setEditValue]       = useState('')
  const [editType, setEditType]         = useState<TransactionType>('despesa')
  const [editError, setEditError]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  function nameCollidesWithCategory(name: string): boolean {
    return categories.some(c => c.name.toLowerCase() === name.toLowerCase())
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    if (nameCollidesWithCategory(trimmed)) {
      setAddError('Já existe uma categoria com esse nome.')
      return
    }
    setAdding(true)
    setAddError('')
    const ok = await createSubcategory(trimmed, newType)
    if (!ok) setAddError('Erro ao criar subcategoria. Tente novamente.')
    else setNewName('')
    setAdding(false)
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const trimmed = editValue.trim()
    if (!trimmed) { setEditing(null); return }
    if (trimmed !== editing.name && nameCollidesWithCategory(trimmed)) {
      setEditError('Já existe uma categoria com esse nome.')
      return
    }
    setSaving(true)
    setEditError('')
    const ok = await renameSubcategory(editing.name, trimmed, editType)
    setSaving(false)
    if (ok) setEditing(null)
    else setEditError('Erro ao salvar. Tente novamente.')
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteSubcategory(deleteTarget)
    setDeleteTarget(null)
    setDeleting(false)
  }

  const bySection = useMemo(() => {
    const buckets: Record<TransactionType, Subcategory[]> = { despesa: [], receita: [], transferencia: [] }
    subcategories.forEach(s => buckets[s.type].push(s))
    return buckets
  }, [subcategories])

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
      <InfoBox id="subcategories-como-funciona" title="O que são Subcategorias?" color="violet">
        <p className="text-violet-600 dark:text-violet-400 leading-relaxed">
          Subcategorias são etiquetas exclusivas da aba <strong>Recorrências</strong>. Elas servem para <strong>agrupar cobranças com nomes diferentes no extrato que representam o mesmo gasto fixo</strong>.
        </p>
        <p className="text-violet-600 dark:text-violet-400 leading-relaxed">
          Muitos gastos recorrentes chegam com descrições que variam mês a mês — como o Pix do aluguel que pode vir como{' '}
          <span className="font-mono bg-violet-100 dark:bg-violet-900/50 px-1 rounded text-xs">FERNANDO AUGUSTO FERREIRA</span>{' '}
          ou{' '}
          <span className="font-mono bg-violet-100 dark:bg-violet-900/50 px-1 rounded text-xs">Pix GRUPO HOUMAX</span>.
          {' '}Sem agrupamento, aparecem como itens separados. Com a subcategoria <strong>Aluguel</strong> aplicada aos dois, viram um único card com a contagem e a média corretas.
        </p>
        <p className="text-violet-600 dark:text-violet-400 leading-relaxed">
          <strong>É diferente de Categoria?</strong> Sim. Categorias (Moradia, Alimentação...) classificam todas as transações e aparecem em todo o app. Subcategorias são um agrupador que existe só dentro de Recorrências. Uma subcategoria também não pode ter o mesmo nome de uma categoria já existente.
        </p>
        <div className="border-t border-violet-200 dark:border-violet-700/50 pt-2.5">
          <p className="font-semibold mb-1">Cada subcategoria tem um tipo fixo</p>
          <p className="text-violet-600 dark:text-violet-400">
            Igual em Recorrências, aqui elas ficam separadas em Despesas, Receitas e Transferências. Em Recorrências, o seletor de subcategoria de um card só mostra as subcategorias do mesmo tipo daquele card — uma despesa nunca pode ganhar uma subcategoria de receita, por exemplo.
          </p>
        </div>
        <div className="border-t border-violet-200 dark:border-violet-700/50 pt-2.5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Como usar
          </p>
          <p className="text-violet-600 dark:text-violet-400">
            Em Recorrências, clique em <strong>+ subcat.</strong> em qualquer card e escolha a subcategoria criada aqui.
          </p>
        </div>
      </InfoBox>

      {/* Criar nova */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Nova subcategoria</p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Ex: Aluguel, Streaming, Academia..."
            value={newName}
            onChange={e => { setNewName(e.target.value); setAddError('') }}
            className="flex-1"
          />
          <Select value={newType} onValueChange={v => setNewType((v ?? 'despesa') as TransactionType)}>
            <SelectTrigger className="w-full sm:w-40 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={!newName.trim() || adding} className="gap-2 bg-violet-600 hover:bg-violet-700 shrink-0">
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

                {items.map(s => (
                  <div
                    key={s.name}
                    className={cn(
                      'bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors group',
                      editing?.name !== s.name && 'flex items-center gap-3'
                    )}
                  >
                    {editing?.name === s.name ? (
                      <>
                        <form onSubmit={handleRename} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                            <Layers className="h-4 w-4 text-violet-500" />
                          </div>
                          <Input
                            autoFocus
                            value={editValue}
                            onChange={e => { setEditValue(e.target.value); setEditError('') }}
                            onKeyDown={e => { if (e.key === 'Escape') setEditing(null) }}
                            className="flex-1 h-8 text-sm"
                          />
                          <Select value={editType} onValueChange={v => setEditType((v ?? 'despesa') as TransactionType)}>
                            <SelectTrigger className="h-8 text-xs w-full sm:w-36 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2 shrink-0">
                            <Button type="submit" size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700" disabled={saving}>
                              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Salvar'}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditing(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </form>
                        {editError && <p className="text-xs text-red-500 mt-1.5 ml-11">{editError}</p>}
                      </>
                    ) : (
                      <>
                        <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                          <Layers className="h-4 w-4 text-violet-500" />
                        </div>
                        <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{s.name}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => { setEditing(s); setEditValue(s.name); setEditType(s.type); setEditError('') }}>
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-8 w-8 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeleteTarget(s.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            )
          })}
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
