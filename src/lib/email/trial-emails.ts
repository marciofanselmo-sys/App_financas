import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/send'
import {
  emailTesteImportar, emailTesteTermina, emailTesteTerminou, emailOfertaTeste, emailCheckoutAbandonado, ResumoTeste,
} from '@/lib/email/templates'
import { checkoutUrl } from '@/lib/checkout-url'
import { TRIAL_BASE_DAYS, trialEndsAt } from '@/lib/trial-config'

type Admin = ReturnType<typeof createAdminClient>
const HORA = 60 * 60 * 1000
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://noblifinance.com.br'
const PAGANTE = ['active', 'past_due']

/** Marca o envio (product_events 'email_teste', chave = qual e-mail). Um envio por pessoa. */
async function marcar(admin: Admin, userId: string, chave: string) {
  await admin.from('product_events').upsert(
    { user_id: userId, event: 'email_teste', dedupe_key: chave, props: {} },
    { onConflict: 'user_id,event,dedupe_key', ignoreDuplicates: true },
  )
}

async function contar(admin: Admin, tabela: string, uid: string, f?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = admin.from(tabela).select('id', { count: 'exact', head: true }).eq('user_id', uid)
  if (f) q = f(q)
  const { count } = await q
  return count ?? 0
}

async function resumo(admin: Admin, uid: string): Promise<ResumoTeste> {
  const [contas, lancamentos, fixos, metas] = await Promise.all([
    contar(admin, 'transaction_boards', uid),
    contar(admin, 'transactions', uid),
    contar(admin, 'recurring_decisions', uid, q => q.eq('decision', 'confirmed')),
    admin.from('goals').select('name').eq('user_id', uid).order('created_at').limit(1).then(r => r.data ?? []),
  ])
  return { contas, lancamentos, fixos, meta: (metas[0]?.name as string | undefined) ?? null }
}

/**
 * Sequência do teste, rodada uma vez por dia (cron das 9h):
 *  - A2 (dia 2): só para quem ainda não importou nenhum extrato;
 *  - A3 (último dia): termina hoje/amanhã, com o que a pessoa construiu;
 *  - A4 (terminou): até 3 dias depois do fim.
 * Quem assinou não recebe nada. Cada e-mail sai uma vez por pessoa.
 */
export async function enviarSequenciaTeste(admin: Admin, agora = Date.now()) {
  const { data: testes } = await admin.from('user_trials').select('user_id, email, started_at, base_ends_at, bonus_hours')
  const lista = testes ?? []
  if (lista.length === 0) return { enviados: [] as string[] }
  const ids = lista.map(t => t.user_id as string)

  const [{ data: subs }, { data: eventos }, { data: perfis }] = await Promise.all([
    admin.from('subscriptions').select('user_id, status').in('user_id', ids),
    admin.from('product_events').select('user_id, event, dedupe_key').in('user_id', ids).in('event', ['primeira_importacao', 'email_teste']),
    admin.from('user_profiles').select('user_id, full_name').in('user_id', ids),
  ])
  const pagante = new Set((subs ?? []).filter(s => PAGANTE.includes(String(s.status))).map(s => s.user_id))
  const nome = new Map((perfis ?? []).map(p => [p.user_id, (p.full_name as string | null) ?? undefined]))
  const ev = eventos ?? []
  const tem = (uid: string, e: string, k = '') => ev.some(x => x.user_id === uid && x.event === e && (k === '' || x.dedupe_key === k))

  const enviados: string[] = []
  for (const t of lista) {
    const uid = t.user_id as string
    if (pagante.has(uid) || !t.email) continue
    const fim = trialEndsAt(t as { base_ends_at: string; bonus_hours: number }).getTime()
    const desde = agora - new Date(t.started_at as string).getTime()
    const ativo = fim > agora
    const n = nome.get(uid)
    const checkout = checkoutUrl(uid, 'email_teste', 'anual')

    if (ativo && desde >= 24 * HORA && desde < 4 * 24 * HORA && !tem(uid, 'primeira_importacao') && !tem(uid, 'email_teste', 'a2')) {
      const r = await enviarEmail(t.email as string, emailTesteImportar({ nome: n }))
      if (!r.error) { await marcar(admin, uid, 'a2'); enviados.push(`a2:${uid}`) }
    }
    if (ativo && fim - agora <= 36 * HORA && !tem(uid, 'email_teste', 'a3')) {
      const hoje = new Date(fim).toDateString() === new Date(agora).toDateString()
      const r = await enviarEmail(t.email as string, emailTesteTermina({ nome: n, quando: hoje ? 'hoje' : 'amanhã', resumo: await resumo(admin, uid), checkout }))
      if (!r.error) { await marcar(admin, uid, 'a3'); enviados.push(`a3:${uid}`) }
    }
    if (!ativo && agora - fim <= 72 * HORA && !tem(uid, 'email_teste', 'a4')) {
      const horas = TRIAL_BASE_DAYS * 24 + Number(t.bonus_hours ?? 0)
      const duracao = `${Math.floor(horas / 24)} dias${horas % 24 ? ` e ${horas % 24} horas` : ''}`
      const r = await enviarEmail(t.email as string, emailTesteTerminou({ nome: n, duracao, checkout }))
      if (!r.error) { await marcar(admin, uid, 'a4'); enviados.push(`a4:${uid}`) }
    }
  }
  return { enviados }
}

/** Quem recebe a oferta do teste: Grátis, nunca fez o teste, ainda não recebeu a oferta. */
export async function publicoOfertaTeste(admin: Admin) {
  const usuarios: { id: string; email: string; nome?: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email) usuarios.push({ id: u.id, email: u.email, nome: (u.user_metadata?.full_name as string | undefined) })
    if (data.users.length < 1000) break
  }
  const [{ data: subs }, { data: testes }, { data: ofertas }] = await Promise.all([
    admin.from('subscriptions').select('user_id, status'),
    admin.from('user_trials').select('user_id, email'),
    admin.from('product_events').select('user_id').eq('event', 'email_teste').eq('dedupe_key', 'oferta'),
  ])
  const pagante = new Set((subs ?? []).filter(s => PAGANTE.includes(String(s.status))).map(s => s.user_id))
  const teveTeste = new Set((testes ?? []).map(t => t.user_id))
  const emailTeste = new Set((testes ?? []).map(t => String(t.email).toLowerCase()))
  const jaRecebeu = new Set((ofertas ?? []).map(o => o.user_id))
  const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '').toLowerCase()
  return usuarios.filter(u =>
    !pagante.has(u.id) && !teveTeste.has(u.id) && !emailTeste.has(u.email.toLowerCase()) && !jaRecebeu.has(u.id)
    && u.email.toLowerCase() !== admins)
}

export async function enviarOfertaTeste(admin: Admin) {
  const publico = await publicoOfertaTeste(admin)
  let ok = 0
  const falhas: string[] = []
  for (const u of publico) {
    const r = await enviarEmail(u.email, emailOfertaTeste({ nome: u.nome }))
    if (r.error) falhas.push(r.error)
    else { ok++; await marcar(admin, u.id, 'oferta') }
    // A Resend aceita poucas chamadas por segundo.
    await new Promise(res => setTimeout(res, 600))
  }
  return { total: publico.length, enviados: ok, falhas }
}

/**
 * Checkout abandonado (evento da Cakto): manda a recuperação com a oferta do
 * teste. Pula quem já assina e quem já recebeu este e-mail nos últimos 7 dias.
 */
export async function enviarRecuperacaoCheckout(
  admin: Admin,
  dados: { email?: string | null; nome?: string | null; checkoutUrl?: string | null },
): Promise<string> {
  const email = dados.email?.trim().toLowerCase()
  if (!email) return 'abandono sem e-mail'
  const { data: sub } = await admin.from('subscriptions').select('status').eq('customer_email', email).in('status', PAGANTE).limit(1)
  if (sub && sub.length > 0) return 'abandono de quem já assina — sem e-mail'
  const seteDias = new Date(Date.now() - 7 * 24 * HORA).toISOString()
  const { count } = await admin.from('cakto_webhook_events').select('id', { count: 'exact', head: true })
    .eq('event', 'checkout_abandonment').eq('customer_email', email).eq('processed', true).gte('received_at', seteDias)
  if ((count ?? 0) > 0) return 'abandono repetido em 7 dias — sem e-mail'
  const checkout = dados.checkoutUrl || `${SITE}/#planos`
  const r = await enviarEmail(email, emailCheckoutAbandonado({ nome: dados.nome ?? undefined, checkout }))
  return r.error ? `falha no e-mail de recuperação: ${r.error}` : 'e-mail de recuperação enviado'
}
