import { PaidTier } from '@/lib/plans'

/**
 * Link do checkout de cada plano, com o id do usuário no `callback` — é ele
 * que o webhook usa para ligar o pagamento à conta certa, sem depender de o
 * e-mail do checkout ser igual ao do cadastro.
 *
 * As três variáveis são escritas uma a uma de propósito: o Next troca
 * `process.env.NEXT_PUBLIC_*` no código durante o build, e acesso dinâmico
 * (process.env[chave]) chegaria vazio no navegador.
 */
const CHECKOUTS: Record<PaidTier, string | undefined> = {
  mensal: process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_MENSAL,
  trimestral: process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_TRIMESTRAL,
  anual: process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_ANUAL,
}

export function checkoutUrl(
  userId: string | null,
  utmSource = 'app',
  tier: PaidTier = 'mensal',
): string {
  const chave = tier
  const base = CHECKOUTS[chave] ?? process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_URL
  if (!base) return '#'
  const url = new URL(base)
  if (userId) url.searchParams.set('callback', userId)
  if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', utmSource)
  url.searchParams.set('plano', chave)
  return url.toString()
}
