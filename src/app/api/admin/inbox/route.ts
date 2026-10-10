import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/admin/require-admin'
import { listarRecebidos, InboxError } from '@/lib/email/inbox'

/** Painel /admin → E-mails: lista da caixa de entrada com "lido / não lido". */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro

  try {
    const emails = await listarRecebidos()
    const ids = emails.map(e => e.id).concat(['-'])
    const admin = createAdminClient()
    const [{ data, error }, respostas] = await Promise.all([
      admin.from('inbox_read').select('email_id').in('email_id', ids),
      admin.from('inbox_replies').select('email_id, replied_at').in('email_id', ids),
    ])
    // Sem a tabela (migration não rodada), tudo aparece como não lido / não respondido.
    const lidos = new Set((data ?? []).map(r => r.email_id))
    const respondidos = new Map<string, string>()
    for (const r of respostas.data ?? []) {
      if ((respondidos.get(r.email_id) ?? '') < r.replied_at) respondidos.set(r.email_id, r.replied_at)
    }
    const lista = emails.map(e => ({ ...e, lido: lidos.has(e.id), respondidoEm: respondidos.get(e.id) ?? null }))
    return NextResponse.json({
      emails: lista,
      naoLidos: lista.filter(e => !e.lido).length,
      semMarcacao: !!error,
      semRespostas: !!respostas.error,
    })
  } catch (e) {
    const status = e instanceof InboxError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha ao ler a caixa' }, { status })
  }
}
