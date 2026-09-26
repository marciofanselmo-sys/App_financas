'use client'

import { useState } from 'react'
import { BillingPeriod, PLANS, PlanTier, maiorDescontoAnual, moeda, precoDe } from '@/lib/plans'
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

const ORDEM: PlanTier[] = ['free', 'essencial', 'completo']

const ITENS: Record<PlanTier, string[]> = {
  free: [
    'Até 2 contas ou cartões',
    'Lançamentos, categorias e eventos sem limite',
    'Histórico completo, sem corte de meses',
    '1 importação de extrato por mês',
  ],
  essencial: [
    'Até 5 contas e cartões',
    'Importação de extrato sem limite',
    'Regras que categorizam sozinhas',
    'Recorrências, parcelas e planejamento mensal',
    'Relatório mensal, metas e exportação em CSV',
  ],
  completo: [
    'Tudo do Essencial, com contas ilimitadas',
    'Todos os relatórios: anual, parcelas, gastos fixos e investimentos',
    'Carteira de investimentos com proventos e alocação',
  ],
}

export function PricingSection() {
  const [periodo, setPeriodo] = useState<BillingPeriod>('mensal')

  return (
    <section id="planos" className="py-20 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
            Escolha como quer começar
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Comece de graça, sem cartão. Quando quiser importar seus extratos sem limite e ver para onde
            vai o seu dinheiro, você assina.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(['mensal', 'anual'] as BillingPeriod[]).map(p => (
                <button
                  key={p} type="button" onClick={() => setPeriodo(p)}
                  className={cn(
                    'px-5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    periodo === p
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700',
                  )}
                >
                  {p === 'mensal' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              {maiorDescontoAnual()}% off no anual
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {ORDEM.map(t => {
            const preco = precoDe(t, periodo)
            const destaque = t === 'completo'
            return (
              <div
                key={t}
                className={cn(
                  'rounded-2xl border bg-white dark:bg-slate-800 p-6 flex flex-col gap-5 shadow-sm',
                  destaque
                    ? 'border-2 border-blue-500 md:-mt-2 md:mb-2'
                    : 'border-slate-200 dark:border-slate-700',
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{PLANS[t].label}</p>
                    {destaque && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        mais completo
                      </span>
                    )}
                  </div>
                  {preco ? (
                    <div className="mt-2">
                      <p className="text-3xl font-extrabold text-[#0B2D6B] dark:text-slate-100">
                        {moeda(preco.porMes)}
                        <span className="text-xs font-medium text-slate-400"> /mês</span>
                      </p>
                      {periodo === 'anual' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {moeda(preco.total)} à vista ·{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            economiza {moeda(preco.economia)}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-3xl font-extrabold text-[#0B2D6B] dark:text-slate-100 mt-2">R$ 0</p>
                  )}
                </div>

                <ul className="space-y-2 flex-1">
                  {ITENS[t].map(item => (
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
                    href={checkoutUrl(null, `site_planos_${t}_${periodo}`, { tier: t, periodo })}
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
