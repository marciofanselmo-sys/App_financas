import { tierFor, type PlanTier } from '@/lib/plans'
import type { AdminUser } from './types'

export function tierDe(u: AdminUser): PlanTier {
  return tierFor(u.subscription?.status ?? 'free', u.subscription?.plan)
}

/** Pagante pela Cakto: o plano vem do pagamento, não se mexe pelo painel. */
export function pagaPelaCakto(u: AdminUser) {
  const s = u.subscription
  return s?.provider === 'cakto' && (s.status === 'active' || s.status === 'past_due')
}

/** Plano pago dado pelo admin, sem cobrança. */
export function ehCortesia(u: AdminUser) {
  return u.subscription?.provider === 'manual' && tierDe(u) !== 'free'
}
