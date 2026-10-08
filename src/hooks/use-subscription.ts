'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'
import { Feature, PLANS, PlanDefinition, PlanTier, TRIAL_PLAN, tierFor } from '@/lib/plans'
import { useTrial } from '@/hooks/use-trial'

export type SubscriptionStatus =
  | 'free' | 'active' | 'past_due' | 'canceled' | 'refunded' | 'chargeback'

export interface Subscription {
  status: SubscriptionStatus
  plan: string
  current_period_end: string | null
  customer_email: string | null
}

/**
 * Assinatura do usuário logado. A tabela é somente leitura para ele — quem
 * escreve é o webhook da Cakto, no servidor.
 *
 * `isPro` é o único ponto do app que decide o que está liberado:
 *  - active   → pago
 *  - past_due → pago com aviso; atraso de cobrança não corta o acesso na hora
 *  - o resto  → plano grátis
 */
export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const { data, error } = await supabase
      .from('subscriptions')
      .select('status, plan, current_period_end, customer_email')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) logSafeError('useSubscription.load', error)
    setSubscription((data as Subscription | null) ?? { status: 'free', plan: 'free', current_period_end: null, customer_email: user.email ?? null })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const trial = useTrial()
  const status = subscription?.status ?? 'free'
  const isPro = status === 'active' || status === 'past_due'
  const tier = tierFor(status, subscription?.plan)
  // Teste grátis em andamento (e sem assinatura): vale o plano de teste.
  const inTrial = !isPro && trial.active
  const plan: PlanDefinition = inTrial ? TRIAL_PLAN : PLANS[tier]
  const can = (feature: Feature) => plan.features[feature]

  return { subscription, status, isPro, inTrial, tier, plan, can, userId, loading: loading || trial.loading, refetch: load }
}

/** Atalho para telas que só precisam saber o que está liberado. */
export function usePlan(): { tier: PlanTier; plan: PlanDefinition; can: (f: Feature) => boolean; loading: boolean; userId: string | null } {
  const { tier, plan, can, loading, userId } = useSubscription()
  return { tier, plan, can, loading, userId }
}

// Fica em src/lib para o servidor (e-mails) usar o mesmo link.
export { checkoutUrl } from '@/lib/checkout-url'
