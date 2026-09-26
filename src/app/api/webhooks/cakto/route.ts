import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCaktoDelivery } from '@/lib/cakto/verify'
import { handleCaktoEvent } from '@/lib/cakto/handle-event'
import { CaktoPayload, ordersOf } from '@/lib/cakto/types'

/**
 * Webhook da Cakto: é aqui que uma venda vira acesso no app.
 *
 * Cadastrar no painel da Cakto apontando para
 *   https://<dominio>/api/webhooks/cakto
 * com os eventos: purchase_approved, subscription_created, subscription_renewed,
 * subscription_canceled, subscription_late, subscription_late_recovered,
 * subscription_paused, subscription_resumed, subscription_renewal_refused,
 * refund, chargeback.
 *
 * Três garantias:
 *  1. Só processa entrega assinada pelo secret (HMAC no header).
 *  2. Guarda o payload cru ANTES de decidir qualquer coisa — se o
 *     processamento falhar, a venda não se perde e dá para reprocessar.
 *  3. Deduplica por pedido+evento: a Cakto reenvia quando a entrega falha, e
 *     uma renovação não pode ser contada duas vezes.
 *
 * Responde 200 mesmo quando o processamento falha, desde que a entrega seja
 * legítima e esteja gravada: erro 5xx faria a Cakto reenviar em looping,
 * sem chance de o reenvio dar certo. O que falhou fica marcado na tabela.
 */

// Precisa do corpo cru, byte a byte, para conferir a assinatura.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function siteUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  const secret = process.env.CAKTO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[cakto] CAKTO_WEBHOOK_SECRET ausente')
    return NextResponse.json({ error: 'webhook não configurado' }, { status: 500 })
  }

  const rawBody = await req.text()

  let payload: CaktoPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 })
  }

  const check = verifyCaktoDelivery({
    rawBody,
    timestamp: req.headers.get('x-cakto-timestamp'),
    signature: req.headers.get('x-cakto-signature'),
    bodySecret: payload.secret,
    secret,
  })
  if (!check.ok) {
    console.warn('[cakto] entrega rejeitada:', check.reason)
    return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const orders = ordersOf(payload)
  const first = orders[0]
  // checkout_abandonment não tem id de pedido — usa o e-mail e a hora.
  const dedupeId = `${payload.event}:${first?.id ?? `${first?.customer?.email ?? 'sem-email'}:${Date.now()}`}`

  const { error: insertError } = await admin.from('cakto_webhook_events').insert({
    id: dedupeId,
    event: payload.event,
    order_id: first?.id ?? null,
    customer_email: first?.customer?.email ?? null,
    // O secret não é gravado: ele é credencial, e o payload vira log.
    payload: { ...payload, secret: undefined },
  })

  if (insertError) {
    // Chave duplicada = reenvio do que já foi processado. Responder 200 é o
    // que faz a Cakto parar de reenviar.
    if (insertError.code === '23505') {
      return NextResponse.json({ ok: true, duplicated: true })
    }
    console.error('[cakto] falha ao registrar entrega:', insertError.message)
    return NextResponse.json({ error: 'falha ao registrar' }, { status: 500 })
  }

  try {
    const results = await handleCaktoEvent(admin, payload, siteUrl(req))
    const failed = results.filter(r => !r.ok)
    await admin
      .from('cakto_webhook_events')
      .update({
        processed: failed.length === 0,
        error: failed.length > 0 ? failed.map(f => f.detail).join(' | ') : null,
        user_id: results.find(r => r.userId)?.userId ?? null,
      })
      .eq('id', dedupeId)

    if (failed.length > 0) console.error('[cakto] processamento parcial:', failed)
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erro desconhecido'
    console.error('[cakto] erro ao processar:', message)
    await admin.from('cakto_webhook_events').update({ processed: false, error: message }).eq('id', dedupeId)
    return NextResponse.json({ ok: false, error: message })
  }
}

/** Ping para conferir que a rota está de pé, sem expor nada. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'cakto-webhook',
    configured: Boolean(process.env.CAKTO_WEBHOOK_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
