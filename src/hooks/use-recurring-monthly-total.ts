'use client'

import { useMemo } from 'react'
import { useRecurring } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { buildDisplayItems } from '@/lib/recurring-groups'

// Mesmo cálculo do card "Fixos confirmados / mês" em /fixos:
// recorrências confirmadas + Cartões & Parcelas ativos. Reflete sempre a
// configuração atual (baseada em hoje), não um histórico por mês.
export function useRecurringMonthlyTotal() {
  const { recurring, installments, loading: recurringLoading } = useRecurring()
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()

  const total = useMemo(() => {
    // "Gastos Previstos" é só despesa — recorrência agora também detecta
    // receita e transferência (usadas em /fixos), mas elas não podem entrar
    // nesse total de gasto usado no Planejamento.
    const displayItems = buildDisplayItems(recurring, new Map())
    const confirmedTotal = displayItems
      .filter(item => item.type === 'despesa' && decisions.get(item.key) === 'confirmed')
      .reduce((s, item) => s + item.avgAmount, 0)
    const installmentsTotal = installments.reduce((s, item) => s + item.monthlyAmount, 0)
    return confirmedTotal + installmentsTotal
  }, [recurring, installments, decisions])

  return { total, loading: recurringLoading || decisionsLoading }
}
