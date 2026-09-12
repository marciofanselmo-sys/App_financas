'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMonthRange } from '@/lib/dashboard-charts'

/** Meta de investimento (investment_target) por mês — chave YYYY-MM. */
export function useBudgetPlansRange(endMonth: number, endYear: number, count: number) {
  const [targetsByKey, setTargetsByKey] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setLoading(false)
        return
      }

      const range = getMonthRange(endMonth, endYear, count)
      const years = [...new Set(range.map(r => r.year))]

      const { data } = await supabase
        .from('budget_plans')
        .select('month, year, investment_target')
        .eq('user_id', user.id)
        .in('year', years)

      if (cancelled) return

      const map: Record<string, number> = {}
      for (const row of data ?? []) {
        const key = `${row.year}-${String(row.month).padStart(2, '0')}`
        map[key] = row.investment_target ?? 0
      }
      setTargetsByKey(map)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [endMonth, endYear, count])

  return { targetsByKey, loading }
}
