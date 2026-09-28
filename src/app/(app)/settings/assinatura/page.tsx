'use client'

import { useSubscription, checkoutUrl } from '@/hooks/use-subscription'
import { PAID_TIERS, PLANS, FEATURE_LABEL, Feature, PlanTier, moeda, periodicidade, precoDe } from '@/lib/plans'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles, AlertTriangle, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Minha assinatura: em que plano o usuário está, até quando vale, e o que
 * cada plano libera. Nada aqui altera a assinatura — quem manda é o webhook
 * da Cakto. Cancelamento também é lá, e o link leva o usuário para lá.
 */

const ORDEM: PlanTier[] = ['free', ...PAID_TIERS]

const STATUS_TEXTO: Record<string, { texto: string; cor: string }> = {
  free:       { texto: 'Plano grátis',            cor: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  active:     { texto: 'Assinatura ativa',        cor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  past_due:   { texto: 'Pagamento atrasado',      cor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  canceled:   { texto: 'Assinatura cancelada',    cor: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  refunded:   { texto: 'Assinatura reembolsada',  cor: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  chargeback: { texto: 'Pagamento contestado',    cor: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const dataBR = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

// Todos os cartões listam as mesmas funcionalidades, na mesma ordem, lidas
// direto de PLANS — o cartão nunca promete algo que o app não libera.
const COMPARE_FEATURES: Feature[] = [
  'rules', 'recurring', 'planning', 'goals', 'reports', 'reportsFull', 'export', 'exportPdf', 'investments',
]
const contas = (t: PlanTier) =>
  PLANS[t].maxBoards === null ? 'Contas e cartões ilimitados' : `Até ${PLANS[t].maxBoards} contas e cartões`
const importacoes = (t: PlanTier) =>
  PLANS[t].importsPerMonth === null
    ? 'Importação de extrato sem limite'
    : `${PLANS[t].importsPerMonth} importação de extrato por mês`

export default function AssinaturaPage() {
  const { subscription, status, tier, userId, loading } = useSubscription()

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {[1, 2].map(i => <div key={i} className="h-32 nobli-card animate-pulse" />)}
      </div>
    )
  }

  const info = STATUS_TEXTO[status] ?? STATUS_TEXTO.free

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
          Minha assinatura
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Seu plano atual e o que cada um libera
        </p>
      </div>

      {/* Situação atual */}
      <div className="nobli-card p-5 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Crown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            Plano {PLANS[tier].label}
          </span>
          <Badge className={cn('text-xs border-0', info.cor)}>{info.texto}</Badge>
        </div>

        {status === 'past_due' && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              A última cobrança não foi aprovada. Seu acesso continua liberado por enquanto — atualize o
              pagamento para não perder os recursos do plano.
            </p>
          </div>
        )}

        {subscription?.current_period_end && (status === 'active' || status === 'past_due') && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Próxima cobrança em <strong>{dataBR(subscription.current_period_end)}</strong>
          </p>
        )}

        {subscription?.customer_email && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Compra registrada no e-mail {subscription.customer_email}
          </p>
        )}

        {tier !== 'free' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
            Para trocar o cartão ou cancelar, use o e-mail de confirmação da compra ou fale com o suporte.
            O cancelamento vale ao fim do período já pago.
          </p>
        )}
      </div>

      {/* Planos — mesma estrutura em todos os cartões, botão sempre no pé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {ORDEM.map(t => {
          const atual = t === tier
          const destaque = t === 'anual'
          const preco = precoDe(t)
          return (
            <div
              key={t}
              className={cn(
                'nobli-card p-5 flex flex-col relative',
                atual && 'ring-2 ring-blue-500',
                !atual && destaque && 'ring-2 ring-blue-200 dark:ring-blue-800/60',
              )}
            >
              <div className="flex items-center justify-between gap-2 min-h-[22px]">
                <p className="font-bold text-slate-800 dark:text-slate-100">{PLANS[t].label}</p>
                {atual ? (
                  <Badge className="text-[10px] border-0 bg-blue-600 text-white">Seu plano</Badge>
                ) : destaque ? (
                  <Badge className="text-[10px] border-0 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Mais vantajoso</Badge>
                ) : null}
              </div>

              {/* Preço: altura fixa para os cartões ficarem alinhados */}
              <div className="mt-3 min-h-[76px]">
                <p className="text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100 whitespace-nowrap">
                  {preco ? moeda(preco.total) : 'R$ 0'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {t === 'free' ? 'para sempre' : periodicidade(t as Exclude<PlanTier, 'free'>)}
                </p>
                {preco && preco.economia > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span>{moeda(preco.porMes)}/mês</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      −{preco.descontoPct}% · economiza {moeda(preco.economia)}
                    </span>
                  </p>
                )}
              </div>

              <ul className="space-y-2 flex-1 border-t border-slate-100 dark:border-white/[0.06] pt-4 mt-3">
                {[contas(t), importacoes(t)].map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
                {COMPARE_FEATURES.map(f => {
                  const tem = PLANS[t].features[f]
                  return (
                    <li
                      key={f}
                      className={cn(
                        'flex items-start gap-2 text-xs leading-snug',
                        tem ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600',
                      )}
                    >
                      {tem
                        ? <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <span className="h-3.5 w-3.5 shrink-0" />}
                      {FEATURE_LABEL[f]}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-5">
                {atual ? (
                  <div className="h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/[0.08] text-sm font-medium text-slate-400 dark:text-slate-500">
                    Plano atual
                  </div>
                ) : t === 'free' ? (
                  <div className="h-10" />
                ) : (
                  <a
                    href={checkoutUrl(userId, `app_planos_${t}`, t)}
                    target="_blank" rel="noopener noreferrer"
                    className={cn(
                      'h-10 inline-flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors',
                      destaque
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30',
                    )}
                  >
                    <Sparkles className="h-4 w-4" /> Assinar {PLANS[t].label}
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        No Trimestral e no Anual você paga uma vez e fica 3 ou 12 meses sem se preocupar.
        Nenhum plano corta o seu histórico: seus lançamentos continuam inteiros mesmo no plano grátis.
        Se uma assinatura terminar, nada é apagado — os recursos pagos apenas deixam de abrir.
      </p>
    </div>
  )
}
