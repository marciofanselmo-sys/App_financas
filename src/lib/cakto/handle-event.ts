import type { SupabaseClient } from '@supabase/supabase-js'
import { CaktoOrderData, CaktoPayload, ordersOf } from './types'
import { enviarEmail } from '@/lib/email/send'
import { PLANS, PaidTier } from '@/lib/plans'
import {
  emailAssinaturaEncerrada, emailBoasVindas, emailPagamentoAtrasado,
  emailPlanoLiberado, emailRenovacao,
} from '@/lib/email/templates'

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

/**
 * Qual plano foi comprado, e por quantos meses vale cada cobrança.
 *
 * O caminho confiável é o id da oferta na Cakto, configurado no ambiente.
 * Sem ele, cai no nome da oferta/produto — que funciona, mas quebra se
 * alguém renomear a oferta no painel. Na dúvida, entrega o plano mais
 * completo: é melhor dar a mais para quem pagou do que a menos.
 *
 * As ofertas antigas (Essencial/Completo, mensal/anual) seguem mapeadas para
 * as renovações de quem assinou antes da troca: o recurso liberado vem do
 * plano novo equivalente, e o período continua o que a pessoa contratou.
 */
export function planoDaOferta(order: CaktoOrderData): { tier: PaidTier; meses: number } {
  const ofertas: Record<string, { tier: PaidTier; meses: number }> = {}
  const mapear = (envVar: string | undefined, tier: PaidTier, meses: number) => {
    if (envVar) ofertas[envVar] = { tier, meses }
  }
  mapear(process.env.CAKTO_OFFER_MENSAL, 'mensal', 1)
  mapear(process.env.CAKTO_OFFER_TRIMESTRAL, 'trimestral', 3)
  mapear(process.env.CAKTO_OFFER_ANUAL, 'anual', 12)
  // Legado
  mapear(process.env.CAKTO_OFFER_ESSENCIAL_MENSAL, 'trimestral', 1)
  mapear(process.env.CAKTO_OFFER_ESSENCIAL_ANUAL, 'trimestral', 12)
  mapear(process.env.CAKTO_OFFER_COMPLETO_MENSAL, 'anual', 1)
  mapear(process.env.CAKTO_OFFER_COMPLETO_ANUAL, 'anual', 12)

  const porId = order.offer?.id ? ofertas[order.offer.id] : undefined
  if (porId) return porId

  const nome = `${order.offer?.name ?? ''} ${order.product?.name ?? ''}`.toLowerCase()
  const meses = /trimestr|3 ?meses/.test(nome) ? 3 : /anual|annual|12 ?meses/.test(nome) ? 12 : 1
  if (/essencial|basico|básico/.test(nome)) return { tier: 'trimestral', meses }
  if (/completo/.test(nome)) return { tier: 'anual', meses }
  return { tier: meses === 12 ? 'anual' : meses === 3 ? 'trimestral' : 'mensal', meses }
}

/**
 * Até quando o acesso pago vale. Um dia de folga além do período evita
 * cortar o cliente no intervalo entre o vencimento e a chegada do webhook
 * de renovação.
 */
export function periodEnd(order: CaktoOrderData, from = new Date()): string {
  const base = order.paidAt ? new Date(order.paidAt) : from
  const end = new Date(base)
  end.setMonth(end.getMonth() + planoDaOferta(order).meses)
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
  /**
   * Só compra aprovada cria conta. Cancelamento, reembolso e chargeback de um
   * e-mail desconhecido não têm o que cancelar — criar conta ali encheria o
   * banco de usuário fantasma (o evento de teste da Cakto, por exemplo, vem
   * com um cliente fictício).
   */
  podeCriarConta: boolean,
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

  // Procura antes de criar: 'magiclink' devolve o usuário existente sem
  // mandar e-mail nenhum.
  const existing = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (!existing.error && existing.data?.user) {
    return { userId: existing.data.user.id, email, created: false }
  }

  if (!podeCriarConta) {
    return { error: `evento de um e-mail sem conta no app (${email}) — nada a fazer` }
  }

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

    const resolved = await resolveUser(admin, order, siteUrl, status === 'active')
    if ('error' in resolved) {
      results.push({ ok: false, detail: resolved.error })
      continue
    }

    const row = {
      user_id: resolved.userId,
      status,
      plan: status === 'active' ? planoDaOferta(order).tier : 'free',
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

    await avisarPorEmail({
      evento: payload.event,
      status,
      resolved,
      nome: order.customer?.name ?? undefined,
      plano: rotuloDoPlano(order),
      proximaCobranca: row.current_period_end,
      admin,
    })

    results.push({ ok: true, detail: `${payload.event} → ${status}`, userId: resolved.userId })
  }

  return results
}

function rotuloDoPlano(order: CaktoOrderData): string {
  return PLANS[planoDaOferta(order).tier].label
}

/**
 * Um e-mail por evento, sempre dizendo o que aconteceu e o que fazer.
 * Nenhum deles carrega senha: quem não tem conta recebe link de uso único.
 *
 * Erro de e-mail não derruba o processamento — a assinatura já está gravada,
 * e é ela que manda no acesso.
 */
async function avisarPorEmail(params: {
  evento: string
  status: SubscriptionStatus
  resolved: ResolvedUser
  nome?: string
  plano: string
  proximaCobranca: string | null
  admin: SupabaseClient
}) {
  const { evento, status, resolved, nome, plano, proximaCobranca, admin } = params

  if (status === 'active' && resolved.created && resolved.inviteLink) {
    // Conta nasceu agora por causa da compra: marca que falta senha e manda o
    // convite. É o único caminho de entrada de quem comprou pelo anúncio.
    await admin.from('user_profiles').upsert(
      { user_id: resolved.userId, full_name: nome ?? '', needs_password: true },
      { onConflict: 'user_id' },
    )
    await enviarEmail(resolved.email, emailBoasVindas({ nome, link: resolved.inviteLink }))
    return
  }

  switch (evento) {
    // 'subscription_created' fica de fora: numa assinatura nova a Cakto manda
    // ele E 'purchase_approved', e o cliente receberia dois e-mails iguais.
    case 'purchase_approved':
    case 'subscription_resumed':
    case 'subscription_late_recovered':
      await enviarEmail(resolved.email, emailPlanoLiberado({ nome, plano }))
      break
    case 'subscription_renewed':
      await enviarEmail(resolved.email, emailRenovacao({ nome, plano, proximaCobranca }))
      break
    case 'subscription_late':
    case 'subscription_renewal_refused':
      await enviarEmail(resolved.email, emailPagamentoAtrasado({ nome }))
      break
    case 'subscription_canceled':
      await enviarEmail(resolved.email, emailAssinaturaEncerrada({ nome, motivo: 'cancelamento' }))
      break
    case 'refund':
      await enviarEmail(resolved.email, emailAssinaturaEncerrada({ nome, motivo: 'reembolso' }))
      break
    // Chargeback é disputa: avisar por e-mail automático pode piorar. Fica só
    // registrado, para vocês tratarem caso a caso.
    default:
      break
  }
}
