'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Transaction, TransactionType, Category, CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/types'

interface TransactionFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: unknown }>
  initialData?: Transaction
}

export function TransactionForm({ open, onClose, onSubmit, initialData }: TransactionFormProps) {
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [amount, setAmount] = useState(initialData ? String(initialData.amount) : '')
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().split('T')[0])
  const [type, setType] = useState<TransactionType>(initialData?.type ?? 'despesa')
  const [category, setCategory] = useState<Category>(initialData?.category ?? 'Outros')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDescription(initialData?.description ?? '')
      setAmount(initialData ? String(initialData.amount) : '')
      setDate(initialData?.date ?? new Date().toISOString().split('T')[0])
      setType(initialData?.type ?? 'despesa')
      setCategory(initialData?.category ?? 'Outros')
      setError('')
    }
  }, [open, initialData])

  const categoryOptions = type === 'receita' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amountNum = parseFloat(amount.replace(',', '.'))
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Informe um valor válido.')
      return
    }

    setLoading(true)
    const { error } = await onSubmit({ description, amount: amountNum, date, type, category })

    if (error) {
      setError('Erro ao salvar transação. Tente novamente.')
      setLoading(false)
      return
    }

    onClose()
    setLoading(false)
  }

  function handleTypeChange(val: TransactionType) {
    setType(val)
    setCategory(val === 'receita' ? 'Salário' : 'Alimentação')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar transação' : 'Nova transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['receita', 'despesa'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`py-2 px-4 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    type === t
                      ? t === 'receita'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
              onChange={(e) => setDescription(e.target.value)}
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
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : initialData ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
