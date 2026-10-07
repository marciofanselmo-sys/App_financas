'use client'

import { useEffect } from 'react'
import { Feature } from '@/lib/plans'
import { usePlan } from '@/hooks/use-subscription'
import { VitrineFrame } from '@/components/plan/vitrine'
import { trackEvent } from '@/lib/analytics/track'

/**
 * Tranca uma tela inteira atrás do plano. Em vez de esconder o item do menu
 * (que faz o usuário achar que o recurso não existe), a tela abre em vitrine:
 * a pessoa vê os próprios números, e o cadeado aparece quando ela tenta
 * aprofundar ou alterar — é assim que o plano grátis vira assinatura.
 *
 * Enquanto o plano carrega, mostra a tela: o bloqueio nunca pisca, e nada
 * aqui protege dado. Quem protege dado é o RLS no banco.
 */
export function withPlan<P extends object>(
  feature: Feature,
  Component: React.ComponentType<P>,
  pitch?: string,
) {
  function Guarded(props: P) {
    const { can, loading } = usePlan()
    const blocked = !loading && !can(feature)
    // Marco do funil: quem abriu cada tela do plano pago (uma vez por tela).
    useEffect(() => { if (blocked) trackEvent('bloqueio_visto', { key: feature }) }, [blocked])
    // Sem o plano, a tela abre em vitrine: números reais, só para consulta.
    if (blocked) {
      return (
        <VitrineFrame feature={feature} pitch={pitch}>
          <Component {...props} />
        </VitrineFrame>
      )
    }
    return <Component {...props} />
  }
  Guarded.displayName = `WithPlan(${Component.displayName ?? Component.name ?? 'Component'})`
  return Guarded
}
