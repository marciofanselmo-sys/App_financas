import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Volta do link de convite / recuperação de senha do Supabase.
 *
 * O link do e-mail leva ao Supabase, que redireciona para cá com um `code`.
 * Aqui esse código vira sessão em cookie — sem isso, quem clica no e-mail
 * cairia na tela de login sem saber a senha (que ninguém definiu ainda).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/primeiro-acesso'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/auth/login?erro=link-invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Link expirado ou já usado: o caminho honesto é pedir uma nova senha.
    return NextResponse.redirect(`${siteUrl}/auth/login?erro=link-expirado`)
  }

  return NextResponse.redirect(`${siteUrl}${next}`)
}
