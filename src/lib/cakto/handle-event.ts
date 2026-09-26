import type { SupabaseClient } from '@supabase/supabase-js'
import { CaktoOrderData, CaktoPayload, ordersOf } from './types'
import { sendWelcomeEmail, sendSubscriptionActiveEmail } from '@/lib/email/send'

/**
 * Traduz um evento da Cakto em acesso dentro do app.
 *
 * Regras que valem para todos os eventos:
 *  - O usuário é achado pelo `callback` (o id dele, que colocamos no link do
 *    checkout) e, na falta dele, pelo e-mail. Quem comprou pelo anúncio sem
 *    ter conta ainda é criado aqui e recebe um link de convite.
 *  - Só o webhook escreve em `subscriptions` — o app apenas lê. Uma aba do
 *    navegador nunca consegue se promover para pago.
 *  - A entrega é gravada crua em `cakto_webhook_events` antes de qualquer
 *    decisão: se o processamento falhar, o dado da venda não se perde.
 */

export type SubscriptionStatus =
  | 'free' | 'active' | 'past_due' | 'canceled' | 'refunded' | 'chargeback'

/** O que cada evento faz com o acesso. null = só registra, não muda nada. */
export function statusForEvent(event: string): SubscriptionStatus | null {
  switch (event) {
    case 'purchase_approved':
    case 'subscription_created':
    case 'subscription_renewed':
    case 'subscription_late_recovered':
    case 'subscription_resumed':
      return 'active'
    // Atrasou: o acesso continua, com aviso na tela. Cortar no primeiro dia
    // de atraso puniria quem só teve um problema no cartão.
    case 'subscription_late':
    case 'subscription_renewal_refused':
      return 'past_due'
    case 'subscription_canceled':
    case 'subscription_paused':
      return 'canceled'
    case 'refund':
      return 'refunded'
    case 'chargeback':
      return 'chargeback'
    default:
      return null
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isAnnual(order: CaktoOrderData): boolean {
  const annualOfferId = process.env.CAKTO_OFFER_ID_ANUAL
  if (annualOfferId && order.offer?.id === annualOfferId) return true
  const name = `${order.offer?.name ?? ''} ${order.product?.name ?? ''}`.toLowerCase()
  return /anual|annual|12 ?meses/.test(name)
}

/**
 * Até quando o acesso pago vale. Um dia de folga além do período evita
 * cortar o cliente no intervalo entre o vencimento e a chegada do webhook
 * de renovação.
 */
export function periodEnd(order: CaktoOrderData, from = new Date()): string {
  const base = order.paidAt ? new Date(order.paidAt) : from
  const end = new Date(base)
  if (isAnnual(order)) end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() + 1)
  return end.toISOString()
}

function utmOf(order: CaktoOrderData) {
  return {
    utm_source: order.utm_source ?? null,
    utm_medium: order.utm_medium ?? null,
    utm_campaign: order.utm_campaign ?? null,
    utm_term: order.utm_term ?? null,
    utm_content: order.utm_content ?? null,
    sck: order.sck ?? null,
  }
}

export interface ResolvedUser {
  userId: string
  email: string
  /** true = a conta foi criada agora por causa da compra. */
  created: boolean
  inviteLink?: string
}

/**
 * Acha (ou cria) o dono da compra.
 *
 * `generateLink({type:'invite'})` cria o usuário e devolve o link de uso
 * único quando o e-mail ainda não existe; quando já existe, ele falha, e aí
 * o mesmo método com 'magiclink' devolve o usuário sem criar nada. É assim
 * que se descobre o id sem varrer a lista inteira de usuários.
 */
export async function resolveUser(
  admin: SupabaseClient,
  order: CaktoOrderData,
  siteUrl: string,
): Promise<ResolvedUser | { error: string }> {
  const email = order.customer?.email?.trim().toLowerCase()

  // 1. O token que colocamos no link do checkout é o caminho confiável: não
  //    depende de o e-mail do pagamento ser igual ao do cadastro.
  const callback = order.callback?.trim()
  if (callback && UUID_RE.test(callback)) {
    const { data, error } = await admin.auth.admin.getUserById(callback)
    if (!error && data?.user) {
      return { userId: data.user.id, email: data.user.email ?? email ?? '', created: false }
    }
  }

  if (!email) return { error: 'compra sem e-mail e sem callback válido' }

  const redirectTo = `${siteUrl}/primeiro-acesso`
  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo, data: { full_name: order.customer?.name ?? '' } },
  })

  if (!invite.error && invite.data?.user) {
    return {
      userId: invite.data.user.id,
      email,
      created: true,
      inviteLink: invite.data.properties?.action_link,
    }
  }

  // Já existe: pega o id sem mandar e-mail nenhum.
  const existing = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (!existing.error && existing.data?.user) {
    return { userId: existing.data.user.id, email, created: false }
  }

  return { error: `não foi possível identificar o usuário (${invite.error?.message ?? 'erro desconhecido'})` }
}

export interface HandleResult {
  ok: boolean
  detail: string
  userId?: string
}

export async function handleCaktoEvent(
  admin: SupabaseClient,
  payload: CaktoPayload,
  siteUrl: string,
): Promise<HandleResult[]> {
  const status = statusForEvent(payload.event)
  const orders = ordersOf(payload)
  const results: HandleResult[] = []

  // Evento que não mexe no acesso (pix gerado, carrinho abandonado) só fica
  // registrado — pode virar automação de recuperação depois.
  if (!status) return [{ ok: true, detail: `evento ${payload.event} registrado, sem efeito no acesso` }]

  for (const order of orders) {
    // Order bump e upsell não são a assinatura; ignora para não sobrescrever.
    if (order.offer_type && order.offer_type !== 'main') {
      results.push({ ok: true, detail: `pedido ${order.id} é ${order.offer_type}, ignorado` })
      continue
    }

    const resolved = await resolveUser(admin, order, siteUrl)
    if ('error' in resolved) {
      results.push({ ok: false, detail: resolved.error })
      continue
    }

    const row = {
      user_id: resolved.userId,
      status,
      plan: status === 'active' ? (isAnnual(order) ? 'pro_anual' : 'pro_mensal') : 'free',
      provider: 'cakto',
      provider_subscription_id: (order.subscription as { id?: string } | null)?.id ?? null,
      provider_order_id: order.id,
      customer_email: resolved.email,
      current_period_end: status === 'active' ? periodEnd(order) : null,
      canceled_at: status === 'canceled' || status === 'refunded' || status === 'chargeback'
        ? new Date().toISOString()
        : null,
      utm: utmOf(order),
      updated_at: new Date().toISOString(),
    }

    const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' })
    if (error) {
      results.push({ ok: false, detail: `falha ao gravar assinatura: ${error.message}`, userId: resolved.userId })
      continue
    }

    if (status === 'active') {
      // Conta criada agora: manda o link de convite (o cliente define a
      // senha). Conta que já existia: só avisa que o acesso foi liberado.
      if (resolved.created && resolved.inviteLink) {
        await admin.from('user_profiles').upsert(
          {
            user_id: resolved.userId,
            full_name: order.customer?.name ?? '',
            needs_password: true,
          },
          { onConflict: 'user_id' },
        )
        await sendWelcomeEmail({
          to: resolved.email,
          name: order.customer?.name ?? '',
          link: resolved.inviteLink,
        })
      } else if (payload.event === 'purchase_approved' || payload.event === 'subscription_created') {
        await sendSubscriptionActiveEmail({ to: resolved.email, name: order.customer?.name ?? '', siteUrl })
      }
    }

    results.push({ ok: true, detail: `${payload.event} → ${status}`, userId: resolved.userId })
  }

  return results
}
