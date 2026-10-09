import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Confere no servidor que quem chamou é admin. Devolve o usuário ou a resposta de erro. */
export async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) }
  const { data: isAdmin, error } = await supabase.rpc('is_app_admin')
  if (error || isAdmin !== true) {
    return { erro: NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 }) }
  }
  return { user }
}
