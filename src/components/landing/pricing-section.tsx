'use client'

import { PAID_TIERS, PLANS, PLAN_ITEMS, PlanTier, moeda, periodicidade, precoDe } from '@/lib/plans'
import { checkoutUrl } from '@/hooks/use-subscription'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

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
            Comece de graça, sem cartão. Quando quiser importar seus extratos sem limite e ver para onde
            vai o seu dinheiro, você assina.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ORDEM.map(t => {
            const preco = precoDe(t)
            const destaque = t === 'anual'
            return (
              <div
                key={t}
                className={cn(
                  'rounded-2xl border bg-white dark:bg-slate-800 p-6 flex flex-col gap-5 shadow-sm',
                  destaque
                    ? 'border-2 border-blue-500 lg:-mt-2 lg:mb-2'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{PLANS[t].label}</p>
                    {destaque && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        mais completo
                      </span>
                    )}
                  </div>
                  {preco && t !== 'free' ? (
                    <div className="mt-2">
                      <p className="text-3xl font-extrabold text-[#0B2D6B] dark:text-slate-100">
                        {moeda(preco.total)}
                        <span className="text-xs font-medium text-slate-400"> {periodicidade(t)}</span>
                      </p>
                      {preco.economia > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {moeda(preco.porMes)}/mês ·{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {preco.descontoPct}% off
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-3xl font-extrabold text-[#0B2D6B] dark:text-slate-100 mt-2">R$ 0</p>
                  )}
                </div>

                <ul className="space-y-2 flex-1">
                  {PLAN_ITEMS[t].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>

                {t === 'free' ? (
                  <a
                    href="/auth/register"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    Criar conta grátis
                  </a>
                ) : (
                  <a
                    href={checkoutUrl(null, `site_planos_${t}`, t)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors"
                  >
                    <Sparkles className="h-4 w-4" /> Assinar {PLANS[t].label}
                  </a>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Cancele quando quiser. Você tem 7 dias para pedir o dinheiro de volta, sem justificativa.
          Nenhum plano apaga o seu histórico.
        </p>
      </div>
    </section>
  )
}
