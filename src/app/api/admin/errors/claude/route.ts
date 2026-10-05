import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Painel /admin → Erros → "Mandar para o Claude".
 *
 * Monta um resumo do erro e dispara a rotina "Corrigir erro do NOBLI" no
 * claude.ai (gatilho de API). Cada disparo abre uma sessão própria do Claude,
 * que investiga, corrige e abre um PR com "NOBLI-ERRO: <ref>" no corpo. Quando
 * o PR entra no main, /api/webhooks/erro-resolvido marca o erro como resolvido.
 *
 * O resumo leva onde, mensagem, código, telas e contagens — nunca e-mail,
 * id de usuário ou qualquer dado de cliente.
 *
 * Variáveis (só no servidor):
 *   CLAUDE_ROUTINE_FIRE_URL  URL /fire da rotina, copiada do claude.ai
 *   CLAUDE_ROUTINE_TOKEN     token do gatilho de API da rotina
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  const { data: isAdmin, error: adminErr } = await supabase.rpc('is_app_admin')
  if (adminErr || isAdmin !== true) return NextResponse.json({ error: 'acesso restrito ao admin' }, { status: 403 })

  const fireUrl = process.env.CLAUDE_ROUTINE_FIRE_URL
  const token = process.env.CLAUDE_ROUTINE_TOKEN
  if (!fireUrl || !token) {
    return NextResponse.json(
      { error: 'Falta configurar CLAUDE_ROUTINE_FIRE_URL e CLAUDE_ROUTINE_TOKEN na Vercel.' },
      { status: 503 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const context = typeof body.context === 'string' ? body.context : null
  const message = typeof body.message === 'string' ? body.message : ''
  if (!context) return NextResponse.json({ error: 'erro não informado' }, { status: 400 })
  const fingerprint = `${context}|${message}`

  const admin = createAdminClient()
  let query = admin.from('app_errors')
    .select('created_at, code, route, user_id, user_agent')
    .eq('context', context)
    .order('created_at', { ascending: false })
    .limit(500)
  query = message ? query.eq('message', message) : query.is('message', null)
  const { data: ocorrencias, error: occErr } = await query
  if (occErr) return NextResponse.json({ error: `falha ao ler o erro: ${occErr.message}` }, { status: 500 })

  const lista = ocorrencias ?? []
  const telas = [...new Set(lista.map(o => o.route).filter(Boolean))]
  const codigos = [...new Set(lista.map(o => o.code).filter(Boolean))]
  const usuarios = new Set(lista.map(o => o.user_id).filter(Boolean)).size
  const navegadores = [...new Set(lista.map(o => o.user_agent).filter(Boolean))].slice(0, 3)
  const ref = randomBytes(4).toString('hex')

  const texto = [
    'Erro registrado no app NOBLI em produção (https://noblifinance.com.br).',
    `Referência para o PR: NOBLI-ERRO: ${ref}`,
    '',
    `Onde (context): ${context}`,
    `Mensagem: ${message || '(sem mensagem)'}`,
    `Código: ${codigos.join(', ') || '—'}`,
    `Telas: ${telas.join(', ') || '—'}`,
    `Ocorrências nos últimos 30 dias: ${lista.length}, de ${usuarios} usuário(s)`,
    lista.length ? `Primeira: ${lista[lista.length - 1].created_at} · Última: ${lista[0].created_at}` : '',
    navegadores.length ? `Navegadores: ${navegadores.join(' | ')}` : '',
  ].filter(l => l !== '').join('\n')

  let sessionUrl: string | null = null
  try {
    const res = await fetch(fireUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: texto }),
    })
    const resposta = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detalhe = resposta?.error?.message ?? `HTTP ${res.status}`
      console.error('[admin/errors/claude] fire falhou:', detalhe)
      return NextResponse.json({ error: `O Claude não aceitou o envio: ${detalhe}` }, { status: 502 })
    }
    sessionUrl = resposta.claude_code_session_url ?? null
  } catch (e) {
    return NextResponse.json({ error: `Falha de rede ao chamar o Claude: ${e instanceof Error ? e.message : e}` }, { status: 502 })
  }

  const agora = new Date().toISOString()
  const { error: upErr } = await admin.from('app_error_status').upsert({
    fingerprint,
    status: 'analise',
    resolved_at: null,
    claude_ref: ref,
    claude_session_url: sessionUrl,
    claude_sent_at: agora,
    pr_url: null,
    updated_at: agora,
    updated_by: user.id,
  }, { onConflict: 'fingerprint' })
  if (upErr) {
    // O Claude já está trabalhando; só o painel não guardou o link.
    console.error('[admin/errors/claude] status não gravado:', upErr.message)
    return NextResponse.json({ sessionUrl, aviso: `Enviado, mas o painel não guardou o link: ${upErr.message}` })
  }

  console.info(`[admin/errors/claude] ${user.email} mandou ${context} para o Claude (ref ${ref})`)
  return NextResponse.json({ sessionUrl, ref })
}
