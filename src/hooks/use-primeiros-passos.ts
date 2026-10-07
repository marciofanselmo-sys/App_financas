'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSubscription } from '@/hooks/use-subscription'
import { useTrialJourney } from '@/hooks/use-trial-journey'
import { trackEvent } from '@/lib/analytics/track'
import { TRIAL_TASKS } from '@/lib/trial-tasks'

/**
 * "Primeiros passos" de quem assina direto, sem passar pelo teste: as mesmas
 * 10 tarefas da jornada, sem horas, num selo do menu, numa gaveta e num card
 * no fim do Dashboard. As telas do app não mudam.
 *
 * Só para contas criadas a partir do lançamento (07/10/2026): quem já assinava
 * antes não passa a ver nada novo. Some quando a pessoa conclui tudo ou oculta.
 */
const CORTE = '2026-10-07'

let info: { carregado: boolean; contaNova: boolean; oculto: boolean } = { carregado: false, contaNova: false, oculto: false }
let pedido: Promise<void> | null = null
const ouvintes = new Set<() => void>()
const mudar = (n: Partial<typeof info>) => { info = { ...info, ...n }; ouvintes.forEach(f => f()) }

async function buscar() {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { mudar({ carregado: true }); return }
    const { count } = await sb.from('product_events').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('event', 'passos_ocultos')
    mudar({ carregado: true, contaNova: (user.created_at ?? '') >= CORTE, oculto: (count ?? 0) > 0 })
  } catch {
    mudar({ carregado: true })
  }
}

/** Pode ver os primeiros passos (antes de saber o que já fez). Usado pelo layout para sincronizar. */
export function usePrimeirosPassosCandidato() {
  const { isPro, inTrial, loading } = useSubscription()
  const snap = useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f) } }, () => info, () => info)
  const pro = !loading && isPro && !inTrial
  useEffect(() => { if (pro && !pedido) pedido = buscar() }, [pro])
  return pro && snap.carregado && snap.contaNova && !snap.oculto
}

export function usePrimeirosPassos() {
  const candidato = usePrimeirosPassosCandidato()
  const { feitas, carregado } = useTrialJourney()
  const proxima = TRIAL_TASKS.find(t => !feitas.has(t.id)) ?? null
  return {
    mostrar: candidato && carregado && !!proxima,
    feitas,
    total: TRIAL_TASKS.length,
    proxima,
  }
}

export function ocultarPrimeirosPassos() {
  trackEvent('passos_ocultos')
  mudar({ oculto: true })
}
