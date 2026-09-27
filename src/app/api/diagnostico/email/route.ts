import { NextResponse } from 'next/server'

/**
 * Diagnóstico do envio de e-mail.
 *
 * Pergunta à própria Resend se a chave é válida e se o domínio do remetente
 * está verificado — que é a diferença entre "configurei" e "vai entregar".
 * Sem isso, a única forma de descobrir que o e-mail não sai seria um cliente
 * pagar e não receber o acesso.
 *
 * Não devolve segredo nenhum: só o nome do domínio, a região e o estado.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY
  const remetente = process.env.RESEND_FROM ?? null

  if (!apiKey) {
    return NextResponse.json({ ok: false, motivo: 'RESEND_API_KEY ausente', remetente })
  }

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ ok: false, motivo: 'chave recusada pela Resend', remetente })
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, motivo: `resend respondeu ${res.status}`, remetente })
    }

    const body = await res.json() as { data?: { name: string; status: string; region?: string }[] }
    const dominios = (body.data ?? []).map(d => ({ dominio: d.name, estado: d.status, regiao: d.region }))

    // O remetente vem como "NOBLI <contato@dominio>" — o que importa é o
    // domínio depois do @, porque é ele que precisa estar verificado.
    const dominioDoRemetente = remetente?.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? null
    const verificado = dominios.some(
      d => d.dominio.toLowerCase() === dominioDoRemetente && d.estado === 'verified',
    )

    return NextResponse.json({
      ok: verificado,
      chave: 'válida',
      remetente,
      dominio_do_remetente: dominioDoRemetente,
      verificado,
      dominios,
      aviso: verificado
        ? null
        : 'O domínio do remetente não aparece como verificado na Resend — os e-mails vão falhar ou cair em spam.',
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      motivo: e instanceof Error ? e.message : 'falha ao falar com a Resend',
      remetente,
    })
  }
}
