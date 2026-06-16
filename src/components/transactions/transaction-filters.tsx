'use client'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCategories } from '@/hooks/use-categories'
import { Search } from 'lucide-react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i)

interface TransactionFiltersProps {
  search: string
  month: number | 'all'
  year: number
  category: string
  onSearchChange: (v: string) => void
  onMonthChange: (v: number | 'all') => void
  onYearChange: (v: number) => void
  onCategoryChange: (v: string) => void
}

export function TransactionFilters({
  search, month, year, category,
  onSearchChange, onMonthChange, onYearChange, onCategoryChange,
}: TransactionFiltersProps) {
  const { categories } = useCategories()

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por descrição..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 bg-white dark:bg-slate-800"
        />
      </div>

      <Select value={String(month)} onValueChange={v => onMonthChange(v === 'all' ? 'all' : Number(v))}>
        <SelectTrigger className="w-full sm:w-36 bg-white dark:bg-slate-800">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os meses</SelectItem>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={v => onYearChange(Number(v))}>
        <SelectTrigger className="w-full sm:w-24 bg-white dark:bg-slate-800">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={v => onCategoryChange(v ?? 'all')}>
        <SelectTrigger className="w-full sm:w-44 bg-white dark:bg-slate-800">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas categorias</SelectItem>
          {categories.map(cat => (
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
  )
}
