import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEMO_COOKIE } from '@/lib/demo'
import { DEMO_VISIT_COOKIE, registrarEventoDemo } from '@/lib/demo-server'

/**
 * Sai da demonstração. `?para=teste` (botão "Criar minha conta grátis"): sai da
 * conta da demo ANTES de ir para o /teste — logado, o /teste começaria o teste
 * na própria conta da demo.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const para = req.nextUrl.searchParams.get('para')
  const visita = req.cookies.get(DEMO_VISIT_COOKIE)?.value
  if (para === 'teste' && visita) await registrarEventoDemo('demo_cta', visita, {})

  const supabase = await createClient()
  await supabase.auth.signOut()

  const res = NextResponse.redirect(para === 'teste' ? `${site}/teste?origem=demo` : `${site}/auth/login`, 302)
  res.cookies.set(DEMO_COOKIE, '', { path: '/', maxAge: 0 })
  res.cookies.set(DEMO_VISIT_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
