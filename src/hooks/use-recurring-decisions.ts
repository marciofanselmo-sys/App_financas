'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'

export type RecurringDecision = 'confirmed' | 'ignored'

export interface RecurringDecisionRecord {
  id: string
  user_id: string
  description_key: string
  decision: RecurringDecision
  created_at: string
}

function uid() {
  return crypto.randomUUID()
}

export function useRecurringDecisions() {
  const [decisions, setDecisions] = useState<Map<string, RecurringDecision>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('recurring_decisions')
        .select('description_key, decision')
        .eq('user_id', user.id)
      const map = new Map<string, RecurringDecision>()
      for (const row of data ?? []) map.set(row.description_key, row.decision)
      setDecisions(map)
      setLoading(false)
    }
    load()
  }, [])

  async function setDecision(descriptionKey: string, decision: RecurringDecision | null): Promise<{ error: unknown }> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    if (decision === null) {
      const { error } = await supabase
        .from('recurring_decisions').delete()
        .eq('user_id', user.id).eq('description_key', descriptionKey)
      if (error) { logSafeError('useRecurringDecisions.delete', error); return { error } }
      setDecisions(prev => { const n = new Map(prev); n.delete(descriptionKey); return n })
      return { error: null }
    }

    // upsert, não "checar o Map e então insert ou update".
    //
    // O Map é o estado desta aba, não o do banco: confirmar dois recorrentes em
    // sequência (ou a mesma decisão em duas abas) fazia as duas chamadas verem
    // "não existe" antes de qualquer escrita terminar, e as duas inseriam.
    // Apoiado na constraint unique (user_id, description_key) de
    // migration_recurring_decisions.sql. (14.20)
    const { error } = await supabase
      .from('recurring_decisions')
      .upsert(
        { id: uid(), user_id: user.id, description_key: descriptionKey, decision, created_at: new Date().toISOString() },
        { onConflict: 'user_id,description_key' },
      )

    if (error) {
      logSafeError('useRecurringDecisions.upsert', error)
      return { error }
    }

    setDecisions(prev => new Map(prev).set(descriptionKey, decision))
    return { error: null }
  }

  return { decisions, loading, setDecision }
}
