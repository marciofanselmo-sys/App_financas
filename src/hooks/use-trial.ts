'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrialRow, trialEndsAt } from '@/lib/trial-config'

/**
 * O teste grátis da conta logada (tabela user_trials, só leitura aqui — quem
 * grava é o servidor). Sem a tabela ou sem teste: `trial` fica null.
 */
export function useTrial() {
  const [trial, setTrial] = useState<TrialRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('user_trials')
          .select('user_id, started_at, base_ends_at, bonus_hours, ended_seen_at')
          .eq('user_id', user.id)
          .maybeSingle()
        if (vivo) setTrial((data as TrialRow | null) ?? null)
      } catch {
        // sem teste
      } finally {
        if (vivo) setLoading(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  const endsAt = trial ? trialEndsAt(trial) : null
  return { trial, endsAt, loading }
}
