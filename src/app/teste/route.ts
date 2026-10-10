import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { iniciarTeste, COOKIE_TESTE } from '@/lib/trial-server'
import { registrarClique, COOKIE_VISITANTE } from '@/lib/link-cliques'
import { enviarEmail } from '@/lib/email/send'
import { emailTesteInicio } from '@/lib/email/templates'

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

  // Conta o clique (Admin › Testes por origem) antes de qualquer desvio.
  const visitante = await registrarClique(req, origem, !!user)
  const marcarVisitante = (res: NextResponse) => {
    if (visitante) res.cookies.set(COOKIE_VISITANTE, visitante, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: true, httpOnly: true })
    return res
  }

  if (user?.email) {
    const r = await iniciarTeste(createAdminClient(), user.id, user.email, origem)
    // Quem já tinha conta (ex.: Grátis que veio pelo e-mail da oferta) também
    // recebe o e-mail 1 da sequência.
    if (r === 'iniciado') {
      await enviarEmail(user.email, emailTesteInicio({ nome: (user.user_metadata?.full_name as string | undefined) }))
    }
    return marcarVisitante(NextResponse.redirect(`${site}/dashboard?teste=${r}`, 302))
  }

  const destino = new URL(`${site}/auth/register`)
  destino.searchParams.set('teste', '1')
  for (const [k, v] of Object.entries(origem)) destino.searchParams.set(k, v)
  const res = NextResponse.redirect(destino.toString(), 302)
  // 30 dias: quem volta depois pelo login comum ainda é reconhecido.
  res.cookies.set(COOKIE_TESTE, JSON.stringify(origem), {
    path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', secure: true, httpOnly: true,
  })
  return marcarVisitante(res)
}
