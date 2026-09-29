import { PLANS, PLAN_COPY, PlanTier, incluiTexto, moeda, precoDe } from '@/lib/plans'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Cartão de um plano — o mesmo na tela Minha assinatura e na landing.
 *
 * Ordem pensada para vender: para quem é → quanto custa por mês → botão →
 * o que o plano acrescenta ao de baixo. O preço grande é sempre o valor por
 * mês (é como a pessoa compara), e logo abaixo vem o que é cobrado de fato,
 * para ninguém se sentir enganado no checkout.
 */

/** O plano em destaque: menor preço por mês e tudo liberado. */
export const PLANO_DESTAQUE: PlanTier = 'anual'

const COBRANCA: Record<Exclude<PlanTier, 'free'>, string> = {
  mensal: 'cobrado todo mês',
  trimestral: 'cobrado a cada 3 meses',
  anual: 'cobrado uma vez por ano',
}

export function PlanCard({ tier, atual = false, cta }: {
  tier: PlanTier
  /** É o plano do usuário logado. */
  atual?: boolean
  /** Botão (ou estado) no lugar da ação. */
  cta: React.ReactNode
}) {
  const copy = PLAN_COPY[tier]
  const preco = precoDe(tier)
  const destaque = tier === PLANO_DESTAQUE
  const inclui = incluiTexto(tier)

  return (
    <div
      className={cn(
        'nobli-card p-5 flex flex-col relative',
        atual && 'ring-2 ring-blue-500',
        !atual && destaque && 'ring-2 ring-blue-500 lg:-mt-2 lg:pb-7',
      )}
    >
      <div className="flex items-center justify-between gap-2 min-h-[22px]">
        <p className="font-bold text-slate-800 dark:text-slate-100">{PLANS[tier].label}</p>
        {atual ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">Seu plano</span>
        ) : destaque ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">Melhor custo-benefício</span>
        ) : null}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px] leading-snug">{copy.tagline}</p>

      {/* Preço: altura fixa para os cartões ficarem alinhados lado a lado */}
      <div className="mt-3 min-h-[92px]">
        <p className="text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100 whitespace-nowrap">
          {preco ? moeda(preco.porMes) : 'R$ 0'}
          <span className="text-xs font-medium text-slate-400"> /mês</span>
        </p>
        {tier === 'free' ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">para sempre, sem cartão</p>
        ) : (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {tier === 'mensal' ? COBRANCA.mensal : `${moeda(preco!.total)} ${COBRANCA[tier]}`}
          </p>
        )}
        {preco && preco.economia > 0 && (
          <span className="inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            economiza {moeda(preco.economia)} ({preco.descontoPct}% off)
          </span>
        )}
      </div>

      <div className="mt-4">{cta}</div>

      <div className="border-t border-slate-100 dark:border-white/[0.06] pt-4 mt-4 flex-1">
        {inclui && (
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">{inclui}</p>
        )}
        <ul className="space-y-2">
          {copy.itens.map((item, i) => (
            <li key={item} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 leading-snug">
              {tier === 'free' && i === 0
                ? <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                : <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
              <span className={cn(tier === 'free' && i === 0 && 'font-medium text-slate-800 dark:text-slate-100')}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Classes do botão de assinar — cheio no destaque, contornado nos demais. */
export function ctaClasses(tier: PlanTier) {
  return cn(
    'h-10 inline-flex w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors',
    tier === PLANO_DESTAQUE
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  )
}
