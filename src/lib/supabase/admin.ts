import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com a chave de serviço: ignora RLS. **Só pode ser usado no
 * servidor** (rotas de API), nunca em componente de tela — a chave dá acesso
 * total ao banco de todos os usuários.
 *
 * É o que o webhook da Cakto usa para gravar assinatura de um usuário que
 * nem está logado no momento do pagamento.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
