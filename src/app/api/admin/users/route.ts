import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAID_TIERS, PlanTier } from '@/lib/plans'

/**
 * Painel /admin → Usuários.
 *
 * Lista todas as contas com papel e plano, e deixa o admin:
 *  - tornar alguém admin (ou tirar)
 *  - dar um plano de cortesia (ou voltar para o grátis)
 *
 * Tudo passa por aqui, no servidor, com a chave de serviço — e só depois de
 * conferir que quem pediu é admin. O navegador nunca escreve direto em
 * user_profiles.role nem em subscriptions.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Admin = ReturnType<typeof createAdminClient>

async function exigirAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erro: NextResponse.json({ error: 'não autenticado' }, { status: 401 }) }

  const { data: isAdmin, error } = await supabase.rpc('is_app_admin')
  if (error || isAdmin !== true) {
    return { erro: NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 }) }
  }
  return { user }
}

async function todosOsUsuarios(admin: Admin) {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 1000) break
  }
  return users
}

export async function GET() {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro

  const admin = createAdminClient()
  try {
    const [users, perfis, assinaturas] = await Promise.all([
      todosOsUsuarios(admin),
      admin.from('user_profiles').select('user_id, full_name, role'),
      admin.from('subscriptions').select('user_id, status, plan, provider, current_period_end, canceled_at'),
    ])
    if (perfis.error) throw perfis.error
    if (assinaturas.error) throw assinaturas.error

    const perfilDe = new Map(perfis.data.map(p => [p.user_id, p]))
    const assinaturaDe = new Map(assinaturas.data.map(s => [s.user_id, s]))

    const lista = users
      .map(u => {
        const perfil = perfilDe.get(u.id)
        const sub = assinaturaDe.get(u.id)
        return {
          id: u.id,
          email: u.email ?? '',
          full_name: perfil?.full_name || (u.user_metadata?.full_name as string | undefined) || '',
          role: perfil?.role === 'admin' ? 'admin' : 'user',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          subscription: sub
            ? { status: sub.status, plan: sub.plan, provider: sub.provider, current_period_end: sub.current_period_end, canceled_at: sub.canceled_at }
            : null,
        }
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    return NextResponse.json({ users: lista, me: auth.user.id })
  } catch (e) {
    console.error('[admin/users] falha ao listar:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'falha ao listar usuários' }, { status: 500 })
  }
}

const PLANOS = new Set<PlanTier>(['free', ...PAID_TIERS])

export async function PATCH(req: NextRequest) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro

  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : null
  if (!userId) return NextResponse.json({ error: 'usuário não informado' }, { status: 400 })

  const admin = createAdminClient()
  const { data: alvo, error: alvoErr } = await admin.auth.admin.getUserById(userId)
  if (alvoErr || !alvo.user) return NextResponse.json({ error: 'usuário não encontrado' }, { status: 404 })

  // ── Papel ────────────────────────────────────────────────────────────────
  if (body.role !== undefined) {
    if (body.role !== 'admin' && body.role !== 'user') {
      return NextResponse.json({ error: 'papel inválido' }, { status: 400 })
    }
    // Tirar o próprio admin trancaria o painel para quem está usando agora.
    if (userId === auth.user.id && body.role === 'user') {
      return NextResponse.json({ error: 'você não pode tirar o seu próprio acesso de admin' }, { status: 400 })
    }

    const { error } = await admin
      .from('user_profiles')
      .upsert({ user_id: userId, role: body.role, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) {
      console.error('[admin/users] falha ao mudar papel:', error.message)
      return NextResponse.json({ error: `falha ao mudar o papel: ${error.message}` }, { status: 500 })
    }
    console.info(`[admin/users] ${auth.user.email} mudou o papel de ${alvo.user.email} para ${body.role}`)
    return NextResponse.json({ ok: true })
  }

  // ── Plano de cortesia ───────────────────────────────────────────────────
  if (body.plan !== undefined) {
    if (!PLANOS.has(body.plan)) return NextResponse.json({ error: 'plano inválido' }, { status: 400 })
    const plan = body.plan as PlanTier

    const { data: atual } = await admin
      .from('subscriptions')
      .select('status, provider')
      .eq('user_id', userId)
      .maybeSingle()

    // Assinatura paga pela Cakto: o plano vem do pagamento, e a próxima
    // renovação sobrescreveria qualquer mudança feita aqui.
    if (atual?.provider === 'cakto' && (atual.status === 'active' || atual.status === 'past_due')) {
      return NextResponse.json(
        { error: 'esta conta tem assinatura paga pela Cakto — o plano é gerenciado por lá' },
        { status: 409 },
      )
    }

    const agora = new Date().toISOString()
    const { error } = await admin.from('subscriptions').upsert({
      user_id: userId,
      status: plan === 'free' ? 'free' : 'active',
      plan,
      provider: 'manual',
      provider_subscription_id: null,
      provider_order_id: null,
      customer_email: alvo.user.email ?? null,
      current_period_end: null,
      canceled_at: plan === 'free' ? agora : null,
      updated_at: agora,
    }, { onConflict: 'user_id' })
    if (error) {
      console.error('[admin/users] falha ao mudar plano:', error.message)
      return NextResponse.json({ error: `falha ao mudar o plano: ${error.message}` }, { status: 500 })
    }
    console.info(`[admin/users] ${auth.user.email} deu o plano ${plan} para ${alvo.user.email}`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'nada para alterar' }, { status: 400 })
}
