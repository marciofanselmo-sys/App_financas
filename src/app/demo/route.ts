import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEMO_COOKIE, DEMO_EMAIL } from '@/lib/demo'
import { demoUserId, registrarEventoDemo, DEMO_VISIT_COOKIE } from '@/lib/demo-server'

/**
 * noblifinance.com.br/demo — "Ver demonstração": entra direto na conta da
 * família Almeida Souza (dados de exemplo), sem cadastro. A senha da conta
 * fica só aqui no servidor (DEMO_PASSWORD), nunca na tela.
 *
 * Se alguém tiver trocado a senha da demo pelo app, a chave de serviço põe a
 * senha de volta e tenta de novo — a porta não pode ficar trancada.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const password = process.env.DEMO_PASSWORD
  const fail = () => NextResponse.redirect(`${site}/auth/login?demo=indisponivel`, 302)
  if (!password) return fail()

  const supabase = await createClient()
  await supabase.auth.signOut()
  let { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password })
  if (error) {
    try {
      const admin = createAdminClient()
      const id = await demoUserId(admin)
      if (id) {
        await admin.auth.admin.updateUserById(id, { email: DEMO_EMAIL, password })
        ;({ error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password }))
      }
    } catch { /* fica no erro abaixo */ }
  }
  if (error) return fail()

  // Virou o mês? As datas da demo andam junto (só na primeira entrada do mês).
  try { await createAdminClient().rpc('demo_alinhar') } catch { /* sem a função: fica como está */ }

  const visita = crypto.randomUUID()
  const origem = req.nextUrl.searchParams.get('origem') ?? req.nextUrl.searchParams.get('utm_source') ?? ''
  await registrarEventoDemo('demo_inicio', visita, origem ? { origem: origem.slice(0, 60) } : {})

  const res = NextResponse.redirect(`${site}/dashboard?tour=1`, 302)
  // Lido pela tela (faixa, tour, só leitura) — não é segredo, por isso não é httpOnly.
  res.cookies.set(DEMO_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 6, sameSite: 'lax', secure: true })
  res.cookies.set(DEMO_VISIT_COOKIE, visita, { path: '/', maxAge: 60 * 60 * 6, sameSite: 'lax', secure: true, httpOnly: true })
  return res
}
