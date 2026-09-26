'use client'

import Link from 'next/link'
import { Feature, FEATURE_LABEL, PLANS, PlanTier, requiredTier } from '@/lib/plans'
import { usePlan, checkoutUrl } from '@/hooks/use-subscription'
import { Lock, Sparkles, Check } from 'lucide-react'

/**
 * Bloqueia um recurso que não está no plano do usuário — mostrando o que ele
 * ganharia, em vez de esconder a tela. Quem não pode usar precisa entender o
 * que existe do outro lado; tela escondida não vende nada.
 *
 * Enquanto o plano carrega, não pisca bloqueio: mostra o conteúdo. O acesso
 * de verdade a dado nunca depende disto — depende do RLS no banco.
 */
interface PlanGateProps {
  feature: Feature
  children: React.ReactNode
  /** Texto curto dizendo o que a pessoa ganha ao liberar. */
  pitch?: string
  /** Prévia borrada do conteúdo real, em vez do cartão sozinho. */
  preview?: React.ReactNode
}

export function PlanGate({ feature, children, pitch, preview }: PlanGateProps) {
  const { can, loading } = usePlan()

  if (loading || can(feature)) return <>{children}</>

  return (
    <div className="space-y-4">
      <UpgradeCard feature={feature} pitch={pitch} />
      {preview && (
        <div className="relative">
          <div className="pointer-events-none select-none blur-[3px] opacity-60">{preview}</div>
          <div className="absolute inset-0" />
        </div>
      )}
    </div>
  )
}

export function UpgradeCard({ feature, pitch }: { feature: Feature; pitch?: string }) {
  const { userId } = usePlan()
  const tier = requiredTier(feature)
  const plano = PLANS[tier]

  return (
    <div className="nobli-card p-6 border-2 border-blue-200 dark:border-blue-800/60">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {FEATURE_LABEL[feature]} está no plano {plano.label}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {pitch ?? 'Libere este recurso e continue de onde parou — seus dados já estão aqui.'}
            </p>
          </div>

          <ul className="space-y-1">
            {resumoDoPlano(tier).map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <a
              href={checkoutUrl(userId, 'app_bloqueio')}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Assinar o {plano.label}
            </a>
            <Link href="/settings/assinatura" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Ver os planos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function resumoDoPlano(tier: PlanTier): string[] {
  if (tier === 'essencial') {
    return [
      'Importação de extrato sem limite (C6, Inter, Itaú, Mercado Pago, Nubank em CSV/OFX)',
      'Regras que categorizam sozinhas o que se repete',
      'Recorrências, parcelas e planejamento mensal',
      'Até 5 contas e cartões',
    ]
  }
  return [
    'Tudo do Essencial, com contas ilimitadas',
    'Todos os relatórios: anual, parcelas, gastos fixos e investimentos',
    'Carteira de investimentos com proventos e alocação',
  ]
}
