'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'
import { Transaction } from '@/types'

/**
 * Saídas das suas contas ligadas a contas de investimento (counterpart_board_id),
 * de todo o histórico — a base do "total aportado" de cada conta.
 */
export function useInvestmentContributions(investmentBoardIds: string[]) {
  const [linked, setLinked] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const key = investmentBoardIds.join(',')

  const load = useCallback(async () => {
    if (!key) { setLinked([]); setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await supabase
      .from('transactions')
      .select('id, date, amount, type, description, board_id, category, counterpart_board_id, is_internal, counterpart_of_id')
      .eq('user_id', user.id)
      .in('counterpart_board_id', key.split(','))
      .order('date', { ascending: false })
    if (error) logSafeError('useInvestmentContributions', error)
    setLinked((data ?? []) as Transaction[])
    setLoading(false)
  }, [key])

  useEffect(() => { load() }, [load])

  return { linked, loading, reload: load }
}
