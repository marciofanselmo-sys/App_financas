import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Contador de uso do plano — hoje só importações por mês.
 *
 * Fica no servidor porque o contador é o que separa o plano grátis do pago:
 * se o navegador pudesse escrever, bastava uma aba aberta para zerá-lo. A
 * leitura é do próprio usuário; a escrita usa a chave de serviço.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FEATURES = new Set(['import'])
const periodoAtual = () => new Date().toISOString().slice(0, 7) // YYYY-MM

async function usuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await usuario()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const feature = req.nextUrl.searchParams.get('feature') ?? 'import'
  if (!FEATURES.has(feature)) return NextResponse.json({ error: 'recurso inválido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('plan_usage')
    .select('count')
    .eq('user_id', user.id).eq('feature', feature).eq('period', periodoAtual())
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'falha ao ler o uso' }, { status: 500 })
  return NextResponse.json({ feature, period: periodoAtual(), count: data?.count ?? 0 })
}

export async function POST(req: NextRequest) {
  const user = await usuario()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const feature = typeof body.feature === 'string' ? body.feature : 'import'
  if (!FEATURES.has(feature)) return NextResponse.json({ error: 'recurso inválido' }, { status: 400 })

  const admin = createAdminClient()
  const period = periodoAtual()

  const { data: atual } = await admin
    .from('plan_usage')
    .select('count')
    .eq('user_id', user.id).eq('feature', feature).eq('period', period)
    .maybeSingle()

  const novo = (atual?.count ?? 0) + 1
  const { error } = await admin.from('plan_usage').upsert(
    { user_id: user.id, feature, period, count: novo, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,feature,period' },
  )

  // Falhar aqui não pode travar a importação que já deu certo: o pior caso é
  // o usuário ganhar uma importação a mais neste mês.
  if (error) return NextResponse.json({ ok: false, count: atual?.count ?? 0 })
  return NextResponse.json({ ok: true, count: novo })
}
