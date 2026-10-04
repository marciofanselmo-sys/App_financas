import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/send'
import { emailConfirmacaoCadastro } from '@/lib/email/templates'

/**
 * Cadastro no plano grátis.
 *
 * Por que não usar `supabase.auth.signUp` do navegador: aquele caminho faz o
 * **Supabase** enviar o e-mail de confirmação, e o serviço de e-mail embutido
 * dele é limitado a **2 mensagens por hora** no projeto inteiro — limite
 * compartilhado entre cadastro, convite, magic link e recuperação de senha.
 * Com campanha no ar, do terceiro cadastro da hora em diante ninguém recebia
 * nada, e a conta ficava criada e não confirmada: a pessoa não entrava, e o
 * erro não dizia por quê.
 *
 * Aqui o e-mail sai pela Resend, que é o mesmo caminho da compra e da
 * recuperação. O Supabase só gera o token; quem entrega somos nós.
 *
 * A resposta não revela se o e-mail já tem conta por acaso: só quando a
 * pessoa realmente tentou se cadastrar com ele, que é quando a informação é
 * dela e serve para ela seguir em frente.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JANELA_MS = 15 * 60 * 1000
const MAX_PEDIDOS = 8
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

export async function POST(req: NextRequest) {
  let email = ''
  let senha = ''
  let nome = ''
  try {
    const body = await req.json() as { email?: string; senha?: string; nome?: string }
    email = (body.email ?? '').trim().toLowerCase()
    senha = body.senha ?? ''
    nome = (body.nome ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, motivo: 'dados-invalidos' }, { status: 400 })
  }

  if (!email.includes('@') || senha.length < 8) {
    return NextResponse.json({ ok: false, motivo: 'dados-invalidos' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'sem-ip'
  if (excedeu(`ip:${ip}`)) {
    return NextResponse.json({ ok: false, motivo: 'muitas-tentativas' }, { status: 429 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

  try {
    const admin = createAdminClient()

    // `type: 'signup'` cria o usuário e devolve o token de confirmação sem
    // disparar e-mail nenhum pelo Supabase.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password: senha,
      options: { data: { full_name: nome } },
    })

    if (error) {
      if (/already (been )?registered|already exists|User already/i.test(error.message)) {
        return NextResponse.json({ ok: false, motivo: 'ja-tem-conta' })
      }
      console.error('[cadastrar] generateLink falhou:', error.message)
      return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })
    }

    const hash = data?.properties?.hashed_token
    if (!hash) return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })

    const link = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=signup&next=/dashboard`
    await enviarEmail(email, emailConfirmacaoCadastro({ nome: nome || undefined, link }))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[cadastrar] erro inesperado:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })
  }
}
