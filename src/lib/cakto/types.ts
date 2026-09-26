/** Eventos que a Cakto entrega e que mudam o acesso do cliente. */
export type CaktoEvent =
  | 'purchase_approved'
  | 'subscription_created'
  | 'subscription_renewed'
  | 'subscription_canceled'
  | 'subscription_late'
  | 'subscription_late_recovered'
  | 'subscription_paused'
  | 'subscription_resumed'
  | 'subscription_renewal_refused'
  | 'refund'
  | 'chargeback'
  | 'purchase_refused'
  | 'checkout_abandonment'
  | 'pix_gerado'
  | 'boleto_gerado'

export interface CaktoCustomer {
  id?: number
  name?: string | null
  email?: string | null
  phone?: string | null
  docNumber?: string | null
}

export interface CaktoOrderData {
  id: string
  refId?: string
  status?: string
  /** main, orderbump, upsell, downsell — só o main é a assinatura. */
  offer_type?: string
  amount?: number | null
  paymentMethod?: string
  customer?: CaktoCustomer
  product?: { id?: string; short_id?: string; name?: string; type?: string }
  offer?: { id?: string; name?: string; price?: number; currency?: string } | null
  subscription?: Record<string, unknown> | null
  subscription_period?: number | null
  /** Token que colocamos em ?callback= no link do checkout: o id do usuário. */
  callback?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  sck?: string | null
  createdAt?: string
  paidAt?: string | null
}

export interface CaktoPayload {
  secret?: string
  event: CaktoEvent | string
  /** O webhook V2 entrega uma lista de pedidos na mesma cobrança. */
  data: CaktoOrderData | CaktoOrderData[]
}

/** V1 manda objeto, V2 manda lista — sempre trate como lista. */
export function ordersOf(payload: CaktoPayload): CaktoOrderData[] {
  if (Array.isArray(payload.data)) return payload.data
  return payload.data ? [payload.data] : []
}
