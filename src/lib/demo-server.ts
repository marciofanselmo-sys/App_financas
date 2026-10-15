import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEMO_EMAIL } from '@/lib/demo'

export const DEMO_VISIT_COOKIE = 'nobli_demo_visita'

let cachedId: string | null = null

/** Id da conta da demonstração (procura pelo e-mail uma vez por instância). */
export async function demoUserId(admin: SupabaseClient = createAdminClient()): Promise<string | null> {
  if (cachedId) return cachedId
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) break
    const u = data.users.find(x => x.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
    if (u) return (cachedId = u.id)
    if (data.users.length < 200) break
  }
  return null
}

/**
 * Marco da demonstração em product_events, na conta da demo. A chave leva o
 * id da visita: muitas pessoas usam a mesma conta e cada uma conta à parte.
 */
export async function registrarEventoDemo(event: string, visita: string, props: Record<string, unknown>, key = '') {
  try {
    const admin = createAdminClient()
    const id = await demoUserId(admin)
    if (!id) return
    await admin.from('product_events').insert({ user_id: id, event, dedupe_key: `${visita}|${key}`.slice(0, 200), props })
  } catch { /* medir nunca derruba a demo */ }
}
