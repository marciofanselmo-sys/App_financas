import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarSequenciaTeste } from '@/lib/email/trial-emails'

/**
 * Cron diário (9h de Brasília, vercel.json): e-mails da sequência do teste.
 * A Vercel chama com "Authorization: Bearer <CRON_SECRET>"; sem o segredo
 * configurado, não roda.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const r = await enviarSequenciaTeste(createAdminClient())
  return NextResponse.json({ ok: true, ...r })
}
