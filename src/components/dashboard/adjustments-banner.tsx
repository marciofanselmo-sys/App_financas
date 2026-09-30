'use client'

import Link from 'next/link'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { usePlan } from '@/hooks/use-subscription'
import { useAdjustments } from '@/hooks/use-adjustments'

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

/**
 * Porta de entrada dos Ajustes sugeridos: sem isto, a correção de dinheiro
 * contando em dobro dependia de o usuário achar a regra "Entre minhas contas"
 * sozinho. Só aparece quando há algo a ajustar.
 */
export function AdjustmentsBanner() {
  const { can, loading } = usePlan()
  if (loading || !can('rules')) return null
  return <Banner />
}

function Banner() {
  const { suggestions, loading } = useAdjustments()
  if (loading || suggestions.length === 0) return null
  const year = suggestions[0].year
  const inflated = suggestions.reduce((s, x) => s + x.expenseThisYear + x.incomeThisYear, 0)
  return (
    <Link
      href="/ajustes"
      className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition-colors"
    >
      <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {suggestions.length === 1 ? '1 ajuste sugerido' : `${suggestions.length} ajustes sugeridos`} para deixar seus números mais certos
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          {inflated > 0
            ? `Dinheiro entre suas contas está somando ${fmt(inflated)} a mais em gastos e ganhos de ${year}. Veja o que foi encontrado antes de aplicar.`
            : 'Dinheiro entre suas contas está contando como gasto e ganho. Veja o que foi encontrado antes de aplicar.'}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-amber-500 shrink-0" />
    </Link>
  )
}
