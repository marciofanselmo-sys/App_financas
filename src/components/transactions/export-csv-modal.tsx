'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { exportToCSV } from '@/utils/export-csv'
import { Category, Transaction, TransactionType } from '@/types'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 8 }, (_, i) => currentYear - i)

const TYPE_OPTIONS: { value: 'all' | TransactionType; label: string }[] = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
  { value: 'transferencia', label: 'Transferência' },
]

interface ExportCSVModalProps {
  open: boolean
  onClose: () => void
  boardId: string
  boardName: string
  initialMonth: number
  initialYear: number
  initialCategory: string
  initialType: 'all' | TransactionType
  initialTag?: string | null
  initialSearch?: string
  categories: Category[]
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'transacoes'
}

function buildFilename(
  boardName: string,
  period: 'month' | 'year' | 'all',
  month: number,
  year: number,
): string {
  const base = slugify(boardName)
  if (period === 'all') return `${base}_historico`
  if (period === 'year') return `${base}_${year}`
  return `${base}_${year}-${String(month).padStart(2, '0')}`
}

async function fetchFilteredTransactions(params: {
  boardId: string
  period: 'month' | 'year' | 'all'
  month: number
  year: number
  category: string
  type: 'all' | TransactionType
  tag?: string | null
  search?: string
}): Promise<Transaction[]> {
  const supabase = createClient()

  function buildQuery() {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('board_id', params.boardId)
      .order('date', { ascending: true })

    if (params.period === 'month') {
      const start = `${params.year}-${String(params.month).padStart(2, '0')}-01`
      const end = new Date(params.year, params.month, 0).toISOString().split('T')[0]
      query = query.gte('date', start).lte('date', end)
    } else if (params.period === 'year') {
      query = query
        .gte('date', `${params.year}-01-01`)
        .lte('date', `${params.year}-12-31`)
    }

    if (params.category !== 'all') {
      query = query.eq('category', params.category)
    }
    if (params.type !== 'all') {
      query = query.eq('type', params.type)
    }
    if (params.search?.trim()) {
      query = query.ilike('description', `%${params.search.trim()}%`)
    }
    if (params.tag) {
      query = query.contains('tags', [params.tag])
    }

    return query
  }

  // Mesma paginação do useTransactions — evita corte silencioso em >1000 linhas
  const PAGE = 1000
  const allData: Transaction[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allData.push(...(data as Transaction[]))
    if (data.length < PAGE) break
  }
  return allData
}

export function ExportCSVModal({
  open,
  onClose,
  boardId,
  boardName,
  initialMonth,
  initialYear,
  initialCategory,
  initialType,
  initialTag,
  initialSearch,
  categories,
}: ExportCSVModalProps) {
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month')
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const [category, setCategory] = useState(initialCategory)
  const [type, setType] = useState<'all' | TransactionType>(initialType)
  const [includeScreenExtras, setIncludeScreenExtras] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sempre reabre com os filtros atuais da tela
  useEffect(() => {
    if (!open) return
    setPeriod('month')
    setMonth(initialMonth)
    setYear(initialYear)
    setCategory(initialCategory)
    setType(initialType)
    setIncludeScreenExtras(Boolean(initialTag || initialSearch?.trim()))
    setError(null)
    setLoading(false)
  }, [open, initialMonth, initialYear, initialCategory, initialType, initialTag, initialSearch])

  const categoryOptions = useMemo(
    () => type === 'all' ? categories : categories.filter(c => c.type === type || c.type === 'ambos'),
    [categories, type],
  )

  useEffect(() => {
    if (category === 'all') return
    const stillValid = categoryOptions.some(c => c.name === category)
    if (!stillValid) setCategory('all')
  }, [category, categoryOptions])

  const periodItems = [
    { value: 'month', label: 'Mês específico' },
    { value: 'year', label: 'Ano inteiro' },
    { value: 'all', label: 'Histórico completo' },
  ]
  const monthItems = MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))
  const yearItems = YEARS.map(y => ({ value: String(y), label: String(y) }))
  const categoryItems = [
    { value: 'all', label: 'Todas as categorias' },
    ...categoryOptions.map(c => ({ value: c.name, label: c.name })),
  ]

  const periodSummary =
    period === 'all'
      ? 'todo o histórico'
      : period === 'year'
        ? `ano de ${year}`
        : `${MONTHS[month - 1]} de ${year}`

  async function handleExport() {
    setLoading(true)
    setError(null)
    try {
      const txs = await fetchFilteredTransactions({
        boardId,
        period,
        month,
        year,
        category,
        type,
        tag: includeScreenExtras ? initialTag : null,
        search: includeScreenExtras ? initialSearch : undefined,
      })
      if (txs.length === 0) {
        setError('Nenhuma transação encontrada com esses filtros.')
        return
      }
      exportToCSV(txs, buildFilename(boardName, period, month, year))
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Escolha o período e os filtros do arquivo. A exportação usa a conta{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{boardName}</span>.
          </p>

          <div className="space-y-2">
            <Label>Período</Label>
            <Select
              value={period}
              onValueChange={v => setPeriod((v ?? 'month') as 'month' | 'year' | 'all')}
              items={periodItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodItems.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {period !== 'all' && (
            <div className="grid grid-cols-2 gap-3">
              {period === 'month' && (
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select
                    value={String(month)}
                    onValueChange={v => setMonth(Number(v))}
                    items={monthItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((name, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={`space-y-2 ${period === 'year' ? 'col-span-2' : ''}`}>
                <Label>Ano</Label>
                <Select
                  value={String(year)}
                  onValueChange={v => setYear(Number(v))}
                  items={yearItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={v => setType((v ?? 'all') as 'all' | TransactionType)}
              items={TYPE_OPTIONS}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={category}
              onValueChange={v => setCategory(v ?? 'all')}
              items={categoryItems}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoryOptions.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(initialTag || initialSearch?.trim()) && (
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeScreenExtras}
                onChange={e => setIncludeScreenExtras(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                Incluir filtros da tela
                {initialSearch?.trim() && <> (busca: &ldquo;{initialSearch.trim()}&rdquo;)</>}
                {initialTag && <> (tag: {initialTag})</>}
              </span>
            </label>
          )}

          <p className="text-xs text-slate-400">
            Será exportado: {periodSummary}
            {type !== 'all' && ` · ${TYPE_OPTIONS.find(o => o.value === type)?.label}`}
            {category !== 'all' && ` · ${category}`}
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={loading} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              {loading ? 'Exportando...' : 'Baixar CSV'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
