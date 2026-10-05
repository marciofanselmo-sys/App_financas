import type { SubscriptionStatus } from '@/hooks/use-subscription'

/** Uma conta como a rota /api/admin/users devolve. */
export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  created_at: string
  last_sign_in_at: string | null
  subscription: {
    status: SubscriptionStatus
    plan: string
    provider: string
    current_period_end: string | null
    canceled_at?: string | null
  } | null
}

export interface CaktoEvent {
  id: string
  event: string
  customer_email: string | null
  processed: boolean
  error: string | null
  received_at: string
}

/** Uma linha de admin_usage_by_user(): linhas de um cliente numa tabela. */
export interface UsageRow {
  uid: string
  table_name: string
  row_count: number
  est_bytes: number
}
