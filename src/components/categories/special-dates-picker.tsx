'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, CalendarDays } from 'lucide-react'
import { SpecialCategoryDate } from '@/types'

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
// Sem isso, o Select mostra o valor bruto ("7") em vez do nome do mês ("jul")
// até o usuário abrir o dropdown pela primeira vez.
const monthItems = MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))

// Agrupa meses consecutivos de um mesmo ano em "AAAA inteiro" quando os 12
// meses estão presentes — só afeta o texto exibido, o array salvo continua
// com uma entrada por mês (isCategoryUsableForDate em special-category-filter.ts
// depende disso, não é uma "faixa" de fato).
export function formatSpecialDateGroups(dates: SpecialCategoryDate[]): string[] {
  const monthsByYear = new Map<number, Set<number>>()
  for (const d of dates) {
    if (!monthsByYear.has(d.year)) monthsByYear.set(d.year, new Set())
    monthsByYear.get(d.year)!.add(d.month)
  }
  const years = [...monthsByYear.keys()].sort((a, b) => a - b)
  const groups: string[] = []
  for (const year of years) {
    const months = monthsByYear.get(year)!
    if (months.size === 12) {
      groups.push(`${year} inteiro`)
    } else {
      for (const m of [...months].sort((a, b) => a - b)) {
        groups.push(`${MONTH_NAMES[m - 1]}/${year}`)
      }
    }
  }
  return groups
}

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

  // Adiciona os 12 meses do ano selecionado de uma vez — continua salvando uma
  // entrada por mês (mesmo formato de sempre), só poupa 12 cliques.
  function addYear() {
    const missing: SpecialCategoryDate[] = []
    for (let m = 1; m <= 12; m++) {
      if (!dates.some(d => d.month === m && d.year === year)) missing.push({ month: m, year })
    }
    if (missing.length === 0) return
    const next = [...dates, ...missing].sort((a, b) => (a.year - b.year) || (a.month - b.month))
    onChange(next)
  }

  function removeDate(m: number, y: number) {
    onChange(dates.filter(d => !(d.month === m && d.year === y)))
  }

  // Remove todos os meses de um ano de uma vez (contraparte de addYear).
  function removeYear(y: number) {
    onChange(dates.filter(d => d.year !== y))
  }

  // Anos com os 12 meses presentes viram um único chip "AAAA inteiro"
  // removível de uma vez (removeYear) — os demais continuam um chip por mês.
  const fullYears = new Set(
    [...new Set(dates.map(d => d.year))].filter(y => dates.filter(d => d.year === y).length === 12)
  )

  return (
    <div className="space-y-2">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fullYears.size > 0 && [...fullYears].sort((a, b) => a - b).map(y => (
            <span
              key={`year-${y}`}
              className="inline-flex items-center gap-1 text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-1 rounded-full font-medium"
            >
              {y} inteiro
              <button type="button" onClick={() => removeYear(y)} className="hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {dates
            .filter(d => !fullYears.has(d.year))
            .map(d => (
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

      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(month)} onValueChange={v => v && setMonth(Number(v))} items={monthItems}>
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
          <Plus className="h-3.5 w-3.5" /> Mês
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addYear} className="h-8 gap-1 text-xs">
          <CalendarDays className="h-3.5 w-3.5" /> Ano inteiro
        </Button>
      </div>

      {dates.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Adicione pelo menos um mês.</p>
      )}
    </div>
  )
}

export { MONTH_NAMES }
