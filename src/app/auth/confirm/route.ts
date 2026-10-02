import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Confirmação dos links de e-mail (convite da compra, recuperação de senha).
 *
 * Por que esta rota existe, e não só a /auth/callback: o link que o Supabase
 * devolve em `generateLink` passa pelo endpoint de verificação dele e, no
 * fluxo implícito, entrega a sessão no **fragmento** da URL (`#access_token`).
 * Fragmento não chega ao servidor, então a sessão nunca virava cookie — quem
 * comprava recebia o e-mail, clicava e caía na tela de login sem ter senha.
 *
 * Aqui o caminho é o recomendado para app com sessão no servidor: usamos o
 * `hashed_token` do convite, trocamos por sessão com `verifyOtp` e só então
 * mandamos a pessoa para a tela de criar senha.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS: EmailOtpType[] = ['invite', 'magiclink', 'recovery', 'email', 'signup', 'email_change']

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const tipo = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/primeiro-acesso'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin

  if (!tokenHash || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.redirect(`${siteUrl}/auth/login?erro=link-invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })

  if (error) {
    // Uso único: link já clicado, expirado ou aberto por um pré-visualizador
    // de e-mail. A saída honesta é o "esqueci minha senha" do login.
    return NextResponse.redirect(`${siteUrl}/auth/login?erro=link-expirado`)
  }

  // `next` é sempre um caminho interno — nunca um endereço vindo de fora.
  const destino = next.startsWith('/') && !next.startsWith('//') ? next : '/primeiro-acesso'
  return NextResponse.redirect(`${siteUrl}${destino}`)
}
