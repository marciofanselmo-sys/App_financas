'use client'

import { PAID_TIERS, PLANS, PlanTier } from '@/lib/plans'
import { checkoutUrl } from '@/hooks/use-subscription'
import { PlanCard, ctaClasses } from '@/components/plan/plan-card'
import { Sparkles } from 'lucide-react'

/**
 * Tabela de planos da página pública.
 *
 * Fonte dos preços e do que cada plano libera é `src/lib/plans.ts`, o mesmo
 * arquivo que o app usa para bloquear recurso — assim a página de vendas
 * nunca promete o que o produto não entrega.
 *
 * Visitante não tem id de usuário, então o link vai sem `callback`: nesse
 * caminho, quem liga a compra à conta é o e-mail do checkout, e o webhook
 * cria a conta e manda o convite.
 */

const ORDEM: PlanTier[] = ['free', ...PAID_TIERS]

export function PricingSection() {
  return (
    <section id="planos" className="py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
            Escolha como quer começar
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Comece de graça, sem cartão — o NOBLI já categoriza sozinho desde o primeiro extrato.
            Quando quiser mais contas e relatórios completos, você assina.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
          {ORDEM.map(t => (
            <PlanCard
              key={t}
              tier={t}
              cta={
                t === 'free' ? (
                  <a
                    href="/auth/register"
                    className="h-10 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    Criar conta grátis
                  </a>
                ) : (
                  <a href={checkoutUrl(null, `site_planos_${t}`, t)} className={ctaClasses(t)}>
                    <Sparkles className="h-4 w-4" /> Assinar {PLANS[t].label}
                  </a>
                )
              }
            />
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Cancele quando quiser. Você tem 7 dias para pedir o dinheiro de volta, sem justificativa.
          Nenhum plano apaga o seu histórico.
        </p>
      </div>
    </section>
  )
}
