import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Fim do teste: marca que a pessoa já viu a tela "Olha o que você construiu"
 * e/ou grava qual conta fica ativa no Grátis. O navegador só lê user_trials;
 * quem grava é aqui.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { visto?: boolean; contaAtiva?: string }
  const admin = createAdminClient()
  const mudar: Record<string, unknown> = {}

  if (body.visto) mudar.ended_seen_at = new Date().toISOString()
  if (body.contaAtiva) {
    const { data: conta } = await admin.from('transaction_boards').select('id')
      .eq('id', body.contaAtiva).eq('user_id', user.id).maybeSingle()
    if (!conta) return NextResponse.json({ ok: false, erro: 'Conta não encontrada.' }, { status: 400 })
    mudar.conta_ativa = conta.id
  }
  if (Object.keys(mudar).length === 0) return NextResponse.json({ ok: true })

  const { error } = await admin.from('user_trials').update(mudar).eq('user_id', user.id)
  if (error) {
    const faltaColuna = /conta_ativa/.test(error.message)
    return NextResponse.json({
      ok: false,
      erro: faltaColuna ? 'Não deu para salvar a escolha agora. Tente de novo mais tarde.' : 'Não deu para salvar agora.',
    }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
