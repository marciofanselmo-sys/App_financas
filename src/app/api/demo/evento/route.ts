import { NextRequest, NextResponse } from 'next/server'
import { DEMO_VISIT_COOKIE, registrarEventoDemo } from '@/lib/demo-server'

const EVENTS = new Set(['demo_tour', 'demo_cta', 'demo_bloqueio'])

/** Marcos da demonstração vindos da tela (tour, convite). Só vale com visita de demo. */
export async function POST(req: NextRequest) {
  const visita = req.cookies.get(DEMO_VISIT_COOKIE)?.value
  if (!visita) return NextResponse.json({ ok: false }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  const event = String(body?.event ?? '')
  if (!EVENTS.has(event)) return NextResponse.json({ ok: false }, { status: 400 })
  await registrarEventoDemo(event, visita, {}, String(body?.key ?? '').slice(0, 60))
  return NextResponse.json({ ok: true })
}
