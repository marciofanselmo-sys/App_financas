'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BudgetPlan {
  id: string
  user_id: string
  month: number
  year: number
  expected_income: number
  expenses_target: number
  investment_target: number
  reserve_target: number
  category_limits: Record<string, number>
  created_at: string
  updated_at: string
}

export function useBudgetPlan(month: number, year: number) {
  const [plan, setPlan] = useState<BudgetPlan | null>(null)
  const [inherited, setInherited] = useState(false)
  const [inheritedFrom, setInheritedFrom] = useState<{ month: number; year: number } | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: exact } = await supabase
      .from('budget_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle()

    if (exact) {
      setPlan(exact)
      setInherited(false)
      setInheritedFrom(null)
      setLoading(false)
      return
    }

    // Sem plano próprio para este mês: herda o planejamento salvo mais recente
    // dentre os meses anteriores (meses passados nunca são alterados por isso).
    const { data: previous } = await supabase
      .from('budget_plans')
      .select('*')
      .eq('user_id', user.id)
      .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (previous) {
      setPlan({ ...previous, month, year })
      setInherited(true)
      setInheritedFrom({ month: previous.month, year: previous.year })
    } else {
      setPlan(null)
      setInherited(false)
      setInheritedFrom(null)
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [month, year])

  async function savePlan(
    planData: Pick<BudgetPlan, 'month' | 'year' | 'expected_income' | 'expenses_target' | 'investment_target' | 'reserve_target' | 'category_limits'>
  ) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('budget_plans')
      .upsert(
        {
          ...planData,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month,year' }
      )
      .select()
      .single()

    if (data) {
      setPlan(data)
      setInherited(false)
      setInheritedFrom(null)
    }
    return { error }
  }

  return { plan, loading, inherited, inheritedFrom, savePlan, refetch: load }
}
