import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Painel /admin → Negócio e Limites: últimos eventos que a Cakto mandou ao
 * webhook. A tabela não tem leitura pelo navegador (guarda o payload inteiro
 * da venda), então passa por aqui, só com os campos que o painel mostra.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_app_admin')
  if (adminErr || isAdmin !== true) return NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 })

  const { data, error } = await createAdminClient()
    .from('cakto_webhook_events')
    .select('id, event, customer_email, processed, error, received_at')
    .order('received_at', { ascending: false })
    .limit(30)
  if (error) {
    console.error('[admin/billing] falha ao listar eventos:', error.message)
    return NextResponse.json({ error: 'falha ao listar eventos da Cakto' }, { status: 500 })
  }
  return NextResponse.json({ events: data })
}
