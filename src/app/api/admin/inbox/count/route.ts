import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/admin/require-admin'
import { listarRecebidos } from '@/lib/email/inbox'

/**
 * Número de e-mails não lidos, para o aviso ao lado de "Admin" no menu.
 * O menu pergunta a cada navegação; guardamos a resposta por 60 s nesta
 * instância para não chamar a Resend a cada clique.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cache: { em: number; naoLidos: number } | null = null
const VALIDADE_MS = 60_000

export async function GET(req: Request) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro

  const forcar = new URL(req.url).searchParams.has('agora')
  if (!forcar && cache && Date.now() - cache.em < VALIDADE_MS) return NextResponse.json({ naoLidos: cache.naoLidos })

  try {
    const emails = await listarRecebidos()
    const { data } = await createAdminClient()
      .from('inbox_read').select('email_id').in('email_id', emails.map(e => e.id).concat(['-']))
    const lidos = new Set((data ?? []).map(r => r.email_id))
    const naoLidos = emails.filter(e => !lidos.has(e.id)).length
    cache = { em: Date.now(), naoLidos }
    return NextResponse.json({ naoLidos })
  } catch {
    // Sem caixa configurada ou chave sem permissão: o menu só não mostra número.
    return NextResponse.json({ naoLidos: 0, indisponivel: true })
  }
}
