import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Chamado pelo GitHub Actions (.github/workflows/erro-resolvido.yml) quando um
 * PR com "NOBLI-ERRO: <ref>" no corpo entra no main. Marca o erro como
 * resolvido no painel Admin, com o link do PR.
 *
 * Protegido por ERRO_RESOLVIDO_SECRET (mesmo valor na Vercel e nos secrets
 * do repositório no GitHub).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// A Vercel leva uns 2 minutos para publicar depois do merge. Ocorrências nesse
// intervalo ainda vêm do código antigo e não devem marcar o erro como "Voltou".
const ATRASO_PUBLICACAO_MS = 5 * 60 * 1000

function tokenValido(recebido: string, esperado: string) {
  const a = Buffer.from(recebido), b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  const segredo = process.env.ERRO_RESOLVIDO_SECRET
  if (!segredo) return NextResponse.json({ error: 'não configurado' }, { status: 503 })
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!tokenValido(auth, segredo)) return NextResponse.json({ error: 'não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ref = typeof body.ref === 'string' && /^[0-9a-f]{8}$/.test(body.ref) ? body.ref : null
  const prUrl = typeof body.pr_url === 'string' && body.pr_url.startsWith('https://github.com/') ? body.pr_url : null
  const prNumber = Number.isInteger(body.pr_number) ? body.pr_number : null
  if (!ref) return NextResponse.json({ error: 'ref inválido' }, { status: 400 })

  const admin = createAdminClient()
  const agora = Date.now()
  const { data, error } = await admin.from('app_error_status')
    .update({
      status: 'resolvido',
      resolved_at: new Date(agora + ATRASO_PUBLICACAO_MS).toISOString(),
      note: `Corrigido pelo Claude${prNumber ? ` no PR #${prNumber}` : ''}`,
      pr_url: prUrl,
      updated_at: new Date(agora).toISOString(),
    })
    .eq('claude_ref', ref)
    .select('fingerprint')
  if (error) {
    console.error('[webhooks/erro-resolvido]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'nenhum erro com esse ref' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
