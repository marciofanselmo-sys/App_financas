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
    // Chave com permissão só de ENVIO não pode listar domínios — usar
    // GET /domains para testar daria "recusada" mesmo com a chave correta.
    // O teste certo é bater no endpoint de envio com um corpo inválido de
    // propósito: 401/403 significa chave ruim; 422/400 significa que a
    // autenticação passou e só o conteúdo foi recusado. Nada é enviado.
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      cache: 'no-store',
    })

    if (res.status === 401 || res.status === 403) {
      const detalhe = (await res.text()).slice(0, 200)
      return NextResponse.json({ ok: false, motivo: 'chave recusada pela Resend', detalhe, remetente })
    }

    // Qualquer outra resposta significa que a chave foi aceita.
    let dominios: unknown = 'não consultado (chave de envio não lista domínios)'
    const lista = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (lista.ok) {
      const body = await lista.json() as { data?: { name: string; status: string }[] }
      dominios = (body.data ?? []).map(d => ({ dominio: d.name, estado: d.status }))
    }

    return NextResponse.json({
      ok: true,
      chave: 'aceita pela Resend',
      status_do_teste: res.status,
      remetente,
      dominios,
    })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      motivo: e instanceof Error ? e.message : 'falha ao falar com a Resend',
      remetente,
    })
  }
}
