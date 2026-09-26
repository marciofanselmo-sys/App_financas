'use client'

import { Feature } from '@/lib/plans'
import { usePlan } from '@/hooks/use-subscription'
import { UpgradeCard } from '@/components/plan/plan-gate'

/**
 * Tranca uma tela inteira atrás do plano. Em vez de esconder o item do menu
 * (que faz o usuário achar que o recurso não existe), a tela abre e explica
 * o que ela faria — é assim que o plano grátis vira assinatura.
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
    if (!loading && !can(feature)) {
      return (
        <div className="max-w-3xl mx-auto">
          <UpgradeCard feature={feature} pitch={pitch} />
        </div>
      )
    }
    return <Component {...props} />
  }
  Guarded.displayName = `WithPlan(${Component.displayName ?? Component.name ?? 'Component'})`
  return Guarded
}
