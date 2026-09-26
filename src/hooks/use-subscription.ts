'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'

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
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

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

  const status = subscription?.status ?? 'free'
  const isPro = status === 'active' || status === 'past_due'

  return { subscription, status, isPro, loading, refetch: load }
}

/** Link do checkout com o id do usuário, que volta no webhook como `callback`. */
export function checkoutUrl(userId: string | null, utmSource = 'app'): string {
  const base = process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_URL
  if (!base) return '#'
  const url = new URL(base)
  if (userId) url.searchParams.set('callback', userId)
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', utmSource)
  return url.toString()
}
