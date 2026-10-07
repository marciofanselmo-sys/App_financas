import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { iniciarTeste, COOKIE_TESTE } from '@/lib/trial-server'

/**
 * noblifinance.com.br/teste — porta do teste grátis de 7 dias.
 *
 *  - Quem chega sem conta: guarda "veio para o teste" (+ UTMs) num cookie e
 *    vai para o cadastro; o cadastro começa o teste na criação da conta.
 *  - Quem já está logado (ex.: usuário do Grátis que recebeu o e-mail): o
 *    teste começa na hora e a pessoa cai no Dashboard.
 *
 * Os UTMs seguem para o cadastro, como no /assinar, para a atribuição não se
 * perder no caminho.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const origem: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k.startsWith('utm_') || k === 'sck' || k === 'origem') origem[k] = v.slice(0, 120)
  })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.email) {
    const r = await iniciarTeste(createAdminClient(), user.id, user.email, origem)
    return NextResponse.redirect(`${site}/dashboard?teste=${r}`, 302)
  }

  const destino = new URL(`${site}/auth/register`)
  destino.searchParams.set('teste', '1')
  for (const [k, v] of Object.entries(origem)) destino.searchParams.set(k, v)
  const res = NextResponse.redirect(destino.toString(), 302)
  // 30 dias: quem volta depois pelo login comum ainda é reconhecido.
  res.cookies.set(COOKIE_TESTE, JSON.stringify(origem), {
    path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: true, httpOnly: true,
  })
  return res
}
