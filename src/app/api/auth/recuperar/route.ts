import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/send'
import { emailRecuperacaoSenha } from '@/lib/email/templates'

/**
 * Pedido de redefinição de senha.
 *
 * Por que o link é montado aqui, e não pelo `resetPasswordForEmail` do
 * Supabase: o e-mail do Supabase leva ao endpoint de verificação deles, que
 * devolve a sessão no fragmento da URL — e fragmento não chega ao servidor.
 * Era exatamente o que quebrava o convite da compra. Aqui geramos o
 * `hashed_token` e mandamos a pessoa para /auth/confirm, que troca o token
 * por sessão em cookie antes de abrir a tela de senha.
 *
 * A resposta é **sempre a mesma**, exista a conta ou não. Responder diferente
 * transformaria esta rota numa ferramenta de descobrir quem é cliente.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Freio por e-mail e por IP, na memória da instância. Não é à prova de tudo
 * (cada instância tem a sua), mas corta o laço óbvio de quem fica pedindo
 * e-mail sem parar — e o custo de um falso negativo aqui é só esperar um
 * minuto para pedir de novo.
 */
const JANELA_MS = 15 * 60 * 1000
const MAX_PEDIDOS = 5
const tentativas = new Map<string, { contagem: number; expiraEm: number }>()

function excedeu(chave: string): boolean {
  const agora = Date.now()
  const atual = tentativas.get(chave)
  if (!atual || agora > atual.expiraEm) {
    tentativas.set(chave, { contagem: 1, expiraEm: agora + JANELA_MS })
    return false
  }
  atual.contagem += 1
  return atual.contagem > MAX_PEDIDOS
}

const RESPOSTA = { ok: true, detail: 'Se existir uma conta com esse e-mail, enviamos o link.' }

export async function POST(req: NextRequest) {
  let email = ''
  try {
    const body = await req.json() as { email?: string }
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json(RESPOSTA)
  }

  if (!email || !email.includes('@')) return NextResponse.json(RESPOSTA)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sem-ip'
  if (excedeu(`email:${email}`) || excedeu(`ip:${ip}`)) return NextResponse.json(RESPOSTA)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

  try {
    const admin = createAdminClient()
    const opcoes = { redirectTo: `${siteUrl}/auth/confirm?next=/primeiro-acesso` }

    let { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: opcoes })
    let tipo: 'recovery' | 'magiclink' = 'recovery'

    // Quem nunca confirmou o e-mail pode não aceitar link de recuperação. O
    // magic link funciona para esse caso e confirma o endereço ao ser usado —
    // sem ele, quem se cadastrou e não recebeu a confirmação ficava trancado
    // para fora sem nenhuma saída.
    if (error || !data?.properties?.hashed_token) {
      const alternativa = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: opcoes })
      if (!alternativa.error && alternativa.data?.properties?.hashed_token) {
        data = alternativa.data
        error = null
        tipo = 'magiclink'
      }
    }

    // Conta inexistente cai aqui. Silêncio proposital: a pessoa recebe a
    // mesma resposta de quem tem conta.
    if (error || !data?.properties?.hashed_token) return NextResponse.json(RESPOSTA)

    const link = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${tipo}&next=/primeiro-acesso`
    const nome = (data.user?.user_metadata?.full_name as string | undefined) ?? undefined

    await enviarEmail(email, emailRecuperacaoSenha({ nome, link }))
  } catch {
    // Falha de infraestrutura não vira mensagem diferente na tela, pelo mesmo
    // motivo: o que a pessoa vê não pode depender de a conta existir.
  }

  return NextResponse.json(RESPOSTA)
}
