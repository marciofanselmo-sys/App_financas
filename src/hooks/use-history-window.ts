'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'
import { PlanTier, inicioDoHistorico, tierFor } from '@/lib/plans'
import type { SubscriptionStatus } from '@/hooks/use-subscription'

/**
 * A janela de histórico do plano, resolvida uma vez por sessão.
 *
 * Por que não usar `useSubscription` aqui: quem precisa da janela é o
 * `useTransactions`, e uma tela só chama esse hook três ou quatro vezes (o
 * dashboard chama três). Cada instância faria a própria consulta de
 * assinatura, e a correção de banda criaria um problema de banda menor no
 * lugar. O plano é o mesmo para todas elas, então a busca é memorizada no
 * módulo e compartilhada.
 *
 * O cache vale 5 minutos e vive só na aba aberta. Quem assina no meio da
 * sessão vê o histórico novo no próximo carregamento da página — a compra já
 * passa pelo checkout e pela volta ao app, então na prática isso não aparece.
 */
const VALIDADE = 5 * 60 * 1000

let cache: { tier: PlanTier; em: number } | null = null
let emVoo: Promise<PlanTier> | null = null

async function buscarTier(): Promise<PlanTier> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    logSafeError('useHistoryWindow.buscarTier', error)
    // Falha de leitura não pode esconder o passado de quem paga: na dúvida,
    // abre a janela maior. O custo de errar para mais é banda; para menos, é
    // o cliente achando que perdeu os lançamentos dele.
    return 'anual'
  }

  const linha = data as { status: SubscriptionStatus; plan: string } | null
  return tierFor(linha?.status ?? 'free', linha?.plan)
}

function tierDaSessao(): Promise<PlanTier> {
  if (cache && Date.now() - cache.em < VALIDADE) return Promise.resolve(cache.tier)
  if (!emVoo) {
    emVoo = buscarTier()
      .then(tier => { cache = { tier, em: Date.now() }; return tier })
      .finally(() => { emVoo = null })
  }
  return emVoo
}

/** Esquece o plano guardado — usar depois de uma troca de plano ou logout. */
export function esquecerJanela() {
  cache = null
}

export interface JanelaHistorico {
  /** Data mínima (`YYYY-MM-DD`) que as consultas devem respeitar. */
  desde: string | null
  tier: PlanTier | null
  /** Ainda buscando: quem consulta o banco deve esperar, para não buscar duas vezes. */
  loading: boolean
}

export function useHistoryWindow(): JanelaHistorico {
  const [janela, setJanela] = useState<JanelaHistorico>(() =>
    cache && Date.now() - cache.em < VALIDADE
      ? { desde: inicioDoHistorico(cache.tier), tier: cache.tier, loading: false }
      : { desde: null, tier: null, loading: true },
  )

  useEffect(() => {
    let vivo = true
    tierDaSessao().then(tier => {
      if (vivo) setJanela({ desde: inicioDoHistorico(tier), tier, loading: false })
    })
    return () => { vivo = false }
  }, [])

  return janela
}
