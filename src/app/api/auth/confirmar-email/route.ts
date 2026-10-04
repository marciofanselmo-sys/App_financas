import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/send'
import { emailBoasVindasCadastro } from '@/lib/email/templates'
import { linkDeConfirmacao } from '@/app/api/auth/cadastrar/route'

/**
 * Reenvia o link de confirmação de e-mail para quem está logado.
 *
 * Só funciona com sessão: o endereço vem do usuário autenticado, nunca do
 * corpo do pedido. Assim ninguém usa esta rota para disparar e-mail para
 * terceiros, e não há o que vazar sobre quem tem conta.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JANELA_MS = 10 * 60 * 1000
const ultimoEnvio = new Map<string, number>()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ ok: false, motivo: 'sem-sessao' }, { status: 401 })
  }

  if (user.email_confirmed_at) {
    return NextResponse.json({ ok: true, motivo: 'ja-confirmado' })
  }

  // Um reenvio a cada 10 minutos por conta: quem clica duas vezes não gera
  // dois e-mails, e o link anterior continua valendo.
  const anterior = ultimoEnvio.get(user.id)
  if (anterior && Date.now() - anterior < JANELA_MS) {
    return NextResponse.json({ ok: true, motivo: 'enviado-recentemente' })
  }
  ultimoEnvio.set(user.id, Date.now())

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

  try {
    const admin = createAdminClient()
    const link = await linkDeConfirmacao(admin, user.email, siteUrl)
    if (!link) return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })

    const nome = (user.user_metadata?.full_name as string | undefined) ?? undefined
    await enviarEmail(user.email, emailBoasVindasCadastro({ nome, link }))
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[confirmar-email] falhou:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })
  }
}
