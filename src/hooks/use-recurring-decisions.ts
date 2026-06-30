'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  async function setDecision(descriptionKey: string, decision: RecurringDecision | null) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (decision === null) {
      await supabase.from('recurring_decisions').delete().eq('user_id', user.id).eq('description_key', descriptionKey)
      setDecisions(prev => { const n = new Map(prev); n.delete(descriptionKey); return n })
      return
    }

    const existing = decisions.get(descriptionKey)
    if (existing) {
      await supabase.from('recurring_decisions').update({ decision }).eq('user_id', user.id).eq('description_key', descriptionKey)
    } else {
      await supabase.from('recurring_decisions').insert({
        id: uid(), user_id: user.id, description_key: descriptionKey, decision, created_at: new Date().toISOString()
      })
    }
    setDecisions(prev => new Map(prev).set(descriptionKey, decision))
  }

  return { decisions, loading, setDecision }
}
