import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { publicoOfertaTeste, enviarOfertaTeste } from '@/lib/email/trial-emails'

/**
 * Oferta do teste para quem já é Grátis (envio único, disparado no Admin).
 * GET: quantas pessoas recebem. POST: envia.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: isAdmin, error } = await supabase.rpc('is_app_admin')
  return !error && isAdmin === true
}

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 })
  const publico = await publicoOfertaTeste(createAdminClient())
  return NextResponse.json({ total: publico.length })
}

export async function POST(req: NextRequest) {
  void req
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 })
  const r = await enviarOfertaTeste(createAdminClient())
  return NextResponse.json(r)
}
