'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Transaction, TransactionType } from '@/types'
import { useCategories } from '@/hooks/use-categories'
import { categoriesForDate, isCategoryUsableForDate } from '@/lib/special-category-filter'
import { addMonths } from '@/utils/add-months'
import { X } from 'lucide-react'

type TransactionData = Omit<Transaction, 'id' | 'user_id' | 'created_at'>
interface SubmitOptions {
  // Usuário marcou "só esta transação" — pula a regra automática de categoria
  // (criar/atualizar regra + aplicar retroativamente), mesmo mudando a categoria.
  skipRuleSync?: boolean
}

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: TransactionData, options?: SubmitOptions) => Promise<{ error: unknown }>
  onSubmitBatch?: (items: TransactionData[]) => Promise<{ error: unknown }>
  initialData?: Transaction
  boardId?: string
}

export function TransactionForm({ open, onClose, onSubmit, onSubmitBatch, initialData, boardId }: TransactionFormProps) {
  const { categories } = useCategories()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<TransactionType>('despesa')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentCount, setInstallmentCount] = useState(2)
  const [skipRuleSync, setSkipRuleSync] = useState(false)
  const tagRef = useRef<HTMLInputElement>(null)

  // Categorias normais e especiais ficam em seletores separados, mas gravam no
  // mesmo campo `category` — escolher em um automaticamente desmarca o outro.
  const usableCategoriesBase = categoriesForDate(categories, date).filter(c => c.type === type || c.type === 'ambos')
  // A categoria JÁ salva na transação sempre aparece como opção, mesmo que hoje
  // ela não passasse no filtro de data (ex: os meses configurados na categoria
  // isolada mudaram depois que a transação foi categorizada) — sem isso, abrir
  // pra editar mostrava o seletor vazio mesmo com uma categoria válida salva.
  const currentCategoryObj = category ? categories.find(c => c.name === category) : undefined
  const usableCategories = currentCategoryObj && !usableCategoriesBase.some(c => c.name === category)
    ? [...usableCategoriesBase, currentCategoryObj]
    : usableCategoriesBase
  const filteredCategories = usableCategories.filter(c => !c.special_dates || c.special_dates.length === 0)
  const specialCategories = usableCategories.filter(c => (c.special_dates?.length ?? 0) > 0)
  const selectedIsSpecial = specialCategories.some(c => c.name === category)
  const isNewTransaction = !initialData
  const canInstallment = isNewTransaction && type === 'despesa' && !!onSubmitBatch
  // Só faz sentido oferecer a opção quando editar de fato muda categoria OU
  // tipo — são esses dois gatilhos (não a edição em si) que propagam pra
  // outras transações com a mesma descrição. Mudar só o Tipo (ex: Despesa ->
  // Transferência) sem mudar a categoria também dispara isso.
  const categoryChanged = !isNewTransaction && category !== initialData?.category
  const typeChanged = !isNewTransaction && type !== initialData?.type
  const hasChangeToSync = categoryChanged || typeChanged

  // Evita que o efeito de baixo limpe a categoria imediatamente ao abrir o
  // formulário pra editar — ele só deve reagir a uma mudança de tipo/data feita
  // pelo usuário DEPOIS de aberto, nunca à carga inicial do valor já salvo.
  const justOpenedRef = useRef(false)

  useEffect(() => {
    if (open) {
      setDescription(initialData?.description ?? '')
      setAmount(initialData ? String(initialData.amount) : '')
      setDate(initialData?.date ?? new Date().toISOString().split('T')[0])
      setType(initialData?.type ?? 'despesa')
      setCategory(initialData?.category ?? '')
      setTags(initialData?.tags ?? [])
      setTagInput('')
      setError('')
      setIsInstallment(false)
      setInstallmentCount(2)
      // Marcada por padrão — editar muda só esta transação. Pra virar regra
      // (afetar todo o histórico com a mesma descrição), o usuário desmarca.
      setSkipRuleSync(true)
      justOpenedRef.current = true
    }
  }, [open, initialData])

  useEffect(() => {
    if (justOpenedRef.current) { justOpenedRef.current = false; return }
    if (!category || categories.length === 0) return
    const still = categories.find(c =>
      c.name === category && (c.type === type || c.type === 'ambos') && isCategoryUsableForDate(c, date)
    )
    if (!still) setCategory('')
  }, [type, date, categories, category])

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amountNum = parseFloat(amount.replace(',', '.'))
    if (isNaN(amountNum) || amountNum <= 0) { setError('Informe um valor válido.'); return }
    if (!category) { setError('Selecione uma categoria.'); return }

    const baseData = {
      description,
      amount: amountNum,
      type,
      category,
      tags,
      board_id: initialData?.board_id ?? boardId ?? null,
    }

    setLoading(true)

    if (canInstallment && isInstallment && installmentCount > 1 && onSubmitBatch) {
      const items: TransactionData[] = Array.from({ length: installmentCount }, (_, i) => ({
        ...baseData,
        date: addMonths(date, i),
        installment_current: i + 1,
        installment_total: installmentCount,
      }))
      const { error } = await onSubmitBatch(items)
      if (error) {
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message : String(error)
        setError(msg || 'Erro ao salvar parcelamento. Tente novamente.')
        setLoading(false)
        return
      }
    } else {
      const { error } = await onSubmit({ ...baseData, date }, { skipRuleSync })
      if (error) {
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message : String(error)
        setError(msg || 'Erro ao salvar transação. Tente novamente.')
        setLoading(false)
        return
      }
    }

    onClose()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar transação' : 'Nova transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-md border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['receita', 'despesa', 'transferencia'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? t === 'receita'
                        ? 'bg-green-600 text-white border-green-600'
                        : t === 'despesa'
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-slate-500 text-white border-slate-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'receita' ? 'Receita' : t === 'despesa' ? 'Despesa' : 'Transferência'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Supermercado, Salário..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {canInstallment && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label>Parcelado?</Label>
                <button
                  type="button"
                  onClick={() => setIsInstallment(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                    isInstallment ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isInstallment ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {isInstallment && (
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <Input
                    type="number"
                    min="2"
                    max="48"
                    value={installmentCount}
                    onChange={e => setInstallmentCount(Math.max(2, Math.min(48, parseInt(e.target.value) || 2)))}
                    className="w-20 h-8 text-center"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">parcelas mensais</span>
                  {amount && !isNaN(parseFloat(amount.replace(',', '.'))) && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium ml-auto">
                      {installmentCount}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount.replace(',', '.')))}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria</Label>
              <a href="/categories" className="text-xs text-blue-600 hover:underline">
                + Gerenciar categorias
              </a>
            </div>
            <div className={specialCategories.length > 0 ? 'grid grid-cols-2 gap-3' : ''}>
              <Select value={selectedIsSpecial ? '' : category} onValueChange={v => { if (v) setCategory(v) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Nenhuma categoria disponível</SelectItem>
                  ) : (
                    filteredCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {specialCategories.length > 0 && (
                <Select value={selectedIsSpecial ? category : ''} onValueChange={v => { if (v) setCategory(v) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Categoria isolada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {specialCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {hasChangeToSync && (
              <label className="flex items-start gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipRuleSync}
                  onChange={e => setSkipRuleSync(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"
                />
                <span>
                  Mudar só esta transação — não aplicar {categoryChanged && typeChanged ? 'a categoria nem o tipo' : categoryChanged ? 'a categoria' : 'o tipo'} em outras transações com a mesma descrição
                </span>
              </label>
            )}
          </div>

          {/* Tags / Etiquetas */}
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div
              className="flex flex-wrap gap-1.5 min-h-10 px-3 py-2 rounded-md border border-input bg-background dark:bg-slate-800 dark:border-slate-600 cursor-text"
              onClick={() => tagRef.current?.focus()}
            >
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs px-2 py-0.5 rounded-full"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagRef}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                placeholder={tags.length === 0 ? 'Digite e pressione Enter...' : ''}
                className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">Pressione Enter ou vírgula para adicionar uma etiqueta</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : initialData ? 'Salvar' : isInstallment ? `Criar ${installmentCount} parcelas` : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
