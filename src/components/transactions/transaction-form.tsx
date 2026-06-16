'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Transaction, TransactionType } from '@/types'
import { useCategories } from '@/hooks/use-categories'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: unknown }>
  initialData?: Transaction
}

export function TransactionForm({ open, onClose, onSubmit, initialData }: TransactionFormProps) {
  const { categories } = useCategories()

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<TransactionType>('despesa')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'ambos')

  useEffect(() => {
    if (open) {
      setDescription(initialData?.description ?? '')
      setAmount(initialData ? String(initialData.amount) : '')
      setDate(initialData?.date ?? new Date().toISOString().split('T')[0])
      setType(initialData?.type ?? 'despesa')
      setCategory(initialData?.category ?? '')
      setError('')
    }
  }, [open, initialData])

  // Ajusta categoria quando tipo muda e a atual não é compatível
  useEffect(() => {
    if (!category) return
    const still = categories.find(c => c.name === category && (c.type === type || c.type === 'ambos'))
    if (!still) setCategory('')
  }, [type, categories, category])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amountNum = parseFloat(amount.replace(',', '.'))
    if (isNaN(amountNum) || amountNum <= 0) { setError('Informe um valor válido.'); return }
    if (!category) { setError('Selecione uma categoria.'); return }

    setLoading(true)
    const { error } = await onSubmit({ description, amount: amountNum, date, type, category })
    if (error) { setError('Erro ao salvar transação. Tente novamente.'); setLoading(false); return }
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
            <div className="grid grid-cols-2 gap-2">
              {(['receita', 'despesa'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? t === 'receita'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-red-500 text-white border-red-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {t === 'receita' ? 'Receita' : 'Despesa'}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Categoria</Label>
              <a href="/categories" className="text-xs text-blue-600 hover:underline">
                + Gerenciar categorias
              </a>
            </div>
            <Select value={category} onValueChange={v => setCategory(v ?? '')}>
              <SelectTrigger>
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
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : initialData ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
