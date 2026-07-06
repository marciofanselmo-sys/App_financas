'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { SpecialCategoryDate } from '@/types'

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

interface SpecialDatesPickerProps {
  dates: SpecialCategoryDate[]
  onChange: (dates: SpecialCategoryDate[]) => void
}

export function SpecialDatesPicker({ dates, onChange }: SpecialDatesPickerProps) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - 1 + i)

  function addDate() {
    if (dates.some(d => d.month === month && d.year === year)) return
    const next = [...dates, { month, year }].sort((a, b) => (a.year - b.year) || (a.month - b.month))
    onChange(next)
  }

  function removeDate(m: number, y: number) {
    onChange(dates.filter(d => !(d.month === m && d.year === y)))
  }

  return (
    <div className="space-y-2">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dates.map(d => (
            <span
              key={`${d.year}-${d.month}`}
              className="inline-flex items-center gap-1 text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-full"
            >
              {MONTH_NAMES[d.month - 1]}/{d.year}
              <button type="button" onClick={() => removeDate(d.month, d.year)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={String(month)} onValueChange={v => v && setMonth(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => v && setYear(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={addDate} className="h-8 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Adicionar mês
        </Button>
      </div>

      {dates.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Adicione pelo menos um mês.</p>
      )}
    </div>
  )
}

export { MONTH_NAMES }
