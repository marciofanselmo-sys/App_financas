import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decodificar, descadastrar, tokenValido } from '@/lib/email/sair'

/**
 * Descadastro dos e-mails de lembrete e oferta.
 * POST vem do botão da página /sair ou do "Cancelar inscrição" do Gmail
 * (List-Unsubscribe-Post). Só POST descadastra: leitores de link que abrem
 * URLs sozinhos (antivírus, prévia) não tiram ninguém da lista.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const email = decodificar(req.nextUrl.searchParams.get('e') ?? '')
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const doFormulario = (req.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')
    && !(await req.clone().text()).includes('List-Unsubscribe=One-Click')

  if (!email || !tokenValido(email, token)) {
    return doFormulario ? NextResponse.redirect(`${site}/sair?erro=link`, 303) : NextResponse.json({ ok: false }, { status: 400 })
  }
  const { error } = await descadastrar(createAdminClient(), email, doFormulario ? 'pagina' : 'um-clique')
  if (error) console.error('[sair]', error)
  if (doFormulario) return NextResponse.redirect(`${site}/sair?${error ? 'erro=falha' : 'ok=1'}`, 303)
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 })
}
