'use client'

import Link from 'next/link'
import { History } from 'lucide-react'
import { PLANS, textoJanela } from '@/lib/plans'
import { usePlan } from '@/hooks/use-subscription'

/**
 * Aviso de que a tela mostra só a janela do plano.
 *
 * Existe para que a ausência de dado antigo nunca seja lida como perda: o
 * texto diz, na mesma frase, o que está sendo mostrado e que o resto continua
 * guardado. Sem isso, quem importou cinco anos de extrato e vê dois abre
 * chamado — ou pior, acha que o app apagou.
 *
 * No plano Anual não aparece: 3 anos é mais do que o app tem de vida, então
 * o aviso só ocuparia espaço sem informar nada.
 */
export function HistoryWindowNote({ className = '' }: { className?: string }) {
  const { tier, loading } = usePlan()
  if (loading || tier === 'anual') return null

  const proximo = tier === 'free' ? 'mensal' : tier === 'mensal' ? 'trimestral' : 'anual'

  return (
    <div className={`flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <History className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <p>
        Seu plano mostra os {textoJanela(tier)}. O que for mais antigo continua guardado —
        volta a aparecer no {PLANS[proximo].label}, que mostra os {textoJanela(proximo)}.{' '}
        <Link href="/settings/assinatura" className="text-blue-600 dark:text-blue-400 hover:underline">
          Ver planos
        </Link>
      </p>
    </div>
  )
}
