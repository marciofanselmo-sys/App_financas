'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const currentYear = new Date().getFullYear()

interface PeriodFilterProps {
  month: number
  year: number
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
}

export function PeriodFilter({ month, year, onMonthChange, onYearChange }: PeriodFilterProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha o picker ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [pickerOpen])

  function prev() {
    if (month === 1) { onMonthChange(12); onYearChange(year - 1) }
    else             { onMonthChange(month - 1) }
  }

  function next() {
    if (month === 12) { onMonthChange(1); onYearChange(year + 1) }
    else              { onMonthChange(month + 1) }
  }

  function selectMonth(m: number, y: number) {
    onMonthChange(m)
    onYearChange(y)
    setPickerOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-sm">
        {/* Seta anterior */}
        <button
          onClick={prev}
          className="flex items-center justify-center h-9 w-9 rounded-l-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Label clicável */}
        <button
          onClick={() => setPickerOpen(o => !o)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-w-[130px] justify-center"
        >
          <span>{MONTHS[month - 1]}</span>
          <span className="font-normal text-slate-400 dark:text-slate-500">{year}</span>
        </button>

        {/* Seta próxima */}
        <button
          onClick={next}
          className="flex items-center justify-center h-9 w-9 rounded-r-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Picker de mês/ano */}
      {pickerOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-[#1a2840] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xl p-4 w-72">
          {/* Seletor de ano */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => onYearChange(year - 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{year}</span>
            <button
              onClick={() => onYearChange(year + 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid de meses */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((name, i) => {
              const m = i + 1
              const isSelected = m === month && year === year
              const isCurrentMonth = m === new Date().getMonth() + 1 && year === currentYear
              return (
                <button
                  key={m}
                  onClick={() => selectMonth(m, year)}
                  className={cn(
                    'py-2 px-1 rounded-xl text-xs font-medium transition-all',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : isCurrentMonth
                        ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-slate-100'
                  )}
                >
                  {name.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
