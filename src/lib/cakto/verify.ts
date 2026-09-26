import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Prova que a entrega veio mesmo da Cakto.
 *
 * A assinatura é HMAC-SHA256 de "{timestamp}.{corpo cru}", com o secret do
 * webhook como chave, no header X-Cakto-Signature (formato "v1=<hex>"). O
 * corpo tem que ser o texto recebido byte a byte: reserializar o JSON muda
 * os bytes e invalida a conferência.
 *
 * A Cakto também manda o secret dentro do corpo, mas isso é pior — ele fica
 * em qualquer log que registre payload. Aqui a assinatura é a via principal;
 * o secret do corpo entra só como reserva, para não perder venda caso uma
 * entrega chegue sem os headers.
 */
const TOLERANCE_SECONDS = 5 * 60

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export interface VerifyResult {
  ok: boolean
  reason?: string
}

export function verifyCaktoDelivery(params: {
  rawBody: string
  timestamp: string | null
  signature: string | null
  bodySecret: unknown
  secret: string
  now?: number
}): VerifyResult {
  const { rawBody, timestamp, signature, bodySecret, secret } = params
  const now = params.now ?? Date.now() / 1000

  if (timestamp && signature) {
    const ts = Number(timestamp)
    if (!Number.isFinite(ts)) return { ok: false, reason: 'timestamp invalido' }
    // Entrega velha pode ser um payload capturado e reenviado depois.
    if (Math.abs(now - ts) > TOLERANCE_SECONDS) return { ok: false, reason: 'fora da janela de tempo' }

    const expected = 'v1=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    // Numa transição de versão o header pode trazer "v1=...,v2=...":
    // confere a versão conhecida e ignora as outras.
    const parts = signature.split(',').map(s => s.trim())
    if (parts.some(part => safeEqual(part, expected))) return { ok: true }
    return { ok: false, reason: 'assinatura nao confere' }
  }

  if (typeof bodySecret === 'string' && bodySecret.length > 0) {
    return safeEqual(bodySecret, secret)
      ? { ok: true }
      : { ok: false, reason: 'secret do corpo nao confere' }
  }

  return { ok: false, reason: 'entrega sem assinatura e sem secret' }
}
