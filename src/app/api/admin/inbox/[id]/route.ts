import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/admin/require-admin'
import { abrirRecebido, InboxError } from '@/lib/email/inbox'

/** Abre um e-mail (e marca como lido) ou volta para "não lido". */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro
  const { id } = await params

  try {
    const email = await abrirRecebido(id)
    const { error } = await createAdminClient().from('inbox_read')
      .upsert({ email_id: id, read_at: new Date().toISOString(), read_by: auth.user.id }, { onConflict: 'email_id' })
    if (error) console.warn('[admin/inbox] não marcou como lido:', error.message)
    return NextResponse.json({ email })
  } catch (e) {
    const status = e instanceof InboxError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha ao abrir o e-mail' }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const { error } = body.lido === false
    ? await admin.from('inbox_read').delete().eq('email_id', id)
    : await admin.from('inbox_read').upsert({ email_id: id, read_at: new Date().toISOString(), read_by: auth.user.id }, { onConflict: 'email_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
