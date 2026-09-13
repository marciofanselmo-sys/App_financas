import { createClient } from '@/lib/supabase/client'
import { formatUserError } from '@/lib/supabase-error'

export async function deleteAccountComplete(password: string, confirmWord: string) {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { password, confirmWord },
  })

  if (error) {
    return { error: formatUserError(error, 'Erro ao excluir conta.') }
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { error: String(data.error) }
  }

  await supabase.auth.signOut()
  return { ok: true as const }
}
