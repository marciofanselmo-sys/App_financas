import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/lib/email/send'
import { emailBoasVindasCadastro, emailTesteInicio } from '@/lib/email/templates'
import { iniciarTeste, COOKIE_TESTE } from '@/lib/trial-server'

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

/**
 * Link que confirma o e-mail. É um magic link: ao ser usado, o Supabase
 * marca o endereço como confirmado e devolve a sessão — serve tanto para
 * quem clicou do próprio navegador quanto para quem abriu no celular.
 */
export async function linkDeConfirmacao(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  siteUrl: string,
): Promise<string | undefined> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm?next=/dashboard` },
    })
    const hash = data?.properties?.hashed_token
    if (error || !hash) return undefined
    return `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink&next=/dashboard`
  } catch {
    return undefined
  }
}

export async function POST(req: NextRequest) {
  let email = ''
  let senha = ''
  let nome = ''
  let teste = false
  try {
    const body = await req.json() as { email?: string; senha?: string; nome?: string; teste?: boolean }
    email = (body.email ?? '').trim().toLowerCase()
    senha = body.senha ?? ''
    nome = (body.nome ?? '').trim()
    teste = body.teste === true
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

    // A conta nasce **sem** o e-mail confirmado, de propósito: quem acabou de
    // vir de um anúncio entra na hora (o login é feito pela própria tela, com
    // a senha que ela escolheu), e a confirmação vira um aviso dentro do app
    // em vez de um portão no meio do caminho. `email_confirmed_at` continua
    // sendo a fonte da verdade sobre quem já provou o endereço.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: false,
      user_metadata: { full_name: nome },
    })

    if (error) {
      if (/already (been )?registered|already exists|User already|duplicate/i.test(error.message)) {
        return NextResponse.json({ ok: false, motivo: 'ja-tem-conta' })
      }
      console.error('[cadastrar] createUser falhou:', error.message)
      return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })
    }

    if (data.user) {
      await admin.from('user_profiles').upsert(
        { user_id: data.user.id, full_name: nome },
        { onConflict: 'user_id' },
      )
    }

    // Veio do /teste (pela URL ou pelo cookie que o /teste deixou): a conta já
    // nasce com o teste de 7 dias. Falha aqui não derruba o cadastro.
    const cookieTeste = req.cookies.get(COOKIE_TESTE)?.value
    let comTeste = false
    if (data.user && (teste || cookieTeste)) {
      let origem: Record<string, string> = {}
      try { origem = cookieTeste ? JSON.parse(cookieTeste) : {} } catch { origem = {} }
      comTeste = (await iniciarTeste(admin, data.user.id, email, origem)) === 'iniciado'
    }

    // Boas-vindas com o link de confirmação. Não bloqueia nada: a pessoa já
    // está entrando. Falha de e-mail aqui não derruba o cadastro.
    const link = await linkDeConfirmacao(admin, email, siteUrl)
    // Com teste, o boas-vindas já é o e-mail 1 da sequência do teste.
    await enviarEmail(email, comTeste
      ? emailTesteInicio({ nome: nome || undefined, link })
      : emailBoasVindasCadastro({ nome: nome || undefined, link }))

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[cadastrar] erro inesperado:', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, motivo: 'falha' }, { status: 500 })
  }
}
