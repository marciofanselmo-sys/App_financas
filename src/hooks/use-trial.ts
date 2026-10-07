'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrialRow, trialEndsAt } from '@/lib/trial-config'

/**
 * O teste grátis da conta logada (tabela user_trials, só leitura aqui — quem
 * grava é o servidor). Buscado uma vez por página e compartilhado entre todas
 * as telas que perguntam (o plano, o relógio, a jornada). `refreshTrial()`
 * busca de novo — usado quando a jornada soma horas.
 */
let cache: { trial: TrialRow | null; loading: boolean } = { trial: null, loading: true }
let pedido: Promise<void> | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach(f => f())
let seq = 0

async function buscar() {
  // A busca inicial da página pode terminar depois da que a jornada pediu ao
  // ganhar horas; só a mais recente vale, senão o relógio volta ao valor velho.
  const minha = ++seq
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (minha !== seq) return
    if (!user) { cache = { trial: null, loading: false }; avisar(); return }
    const { data } = await supabase
      .from('user_trials')
      .select('user_id, started_at, base_ends_at, bonus_hours, ended_seen_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (minha !== seq) return
    cache = { trial: (data as TrialRow | null) ?? null, loading: false }
  } catch {
    if (minha !== seq) return
    cache = { trial: null, loading: false }
  }
  avisar()
}

export function refreshTrial(): Promise<void> {
  pedido = buscar()
  return pedido
}

export function useTrial() {
  const snap = useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
    () => cache,
    () => cache,
  )
  useEffect(() => { if (!pedido) void refreshTrial() }, [])

  // "Agora" de minuto em minuto: o teste vira inativo sozinho quando zera.
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => {
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const endsAt = snap.trial ? trialEndsAt(snap.trial) : null
  const active = !!endsAt && agora !== null && endsAt.getTime() > agora
  return { trial: snap.trial, endsAt, active, loading: snap.loading || agora === null }
}
