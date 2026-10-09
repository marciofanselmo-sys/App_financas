import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Descadastro dos e-mails de lembrete e oferta.
 *
 * O link leva o e-mail e uma assinatura (HMAC) dele: ninguém consegue
 * descadastrar outra pessoa trocando o endereço na URL. Sem segredo
 * configurado, não há link (e nada quebra).
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://noblifinance.com.br'
const segredo = () => process.env.EMAIL_SAIR_SECRET ?? ''

const normal = (email: string) => email.trim().toLowerCase()
const codificar = (email: string) => Buffer.from(normal(email)).toString('base64url')

export function decodificar(e: string): string | null {
  try { return normal(Buffer.from(e, 'base64url').toString('utf8')) || null } catch { return null }
}

function assinatura(email: string): string {
  return createHmac('sha256', segredo()).update(`sair:${normal(email)}`).digest('base64url').slice(0, 32)
}

export function tokenValido(email: string, token: string): boolean {
  if (!segredo() || !token) return false
  const a = Buffer.from(assinatura(email))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Página de confirmação (o link do rodapé). */
export function linkSair(email: string): string | null {
  if (!segredo()) return null
  return `${SITE}/sair?e=${codificar(email)}&t=${assinatura(email)}`
}

/** Endereço do descadastro em um clique (cabeçalho List-Unsubscribe). */
export function linkSairUmClique(email: string): string | null {
  if (!segredo()) return null
  return `${SITE}/api/email/sair?e=${codificar(email)}&t=${assinatura(email)}`
}

type Admin = ReturnType<typeof createAdminClient>

/** Já pediu para sair? Sem a tabela (migração não rodada), responde que não. */
export async function descadastrado(admin: Admin, email: string): Promise<boolean> {
  const { data, error } = await admin.from('email_optouts').select('email').eq('email', normal(email)).maybeSingle()
  return !error && !!data
}

export async function descadastrar(admin: Admin, email: string, origem: string): Promise<{ error: string | null }> {
  const { error } = await admin.from('email_optouts').upsert({ email: normal(email), origem }, { onConflict: 'email', ignoreDuplicates: true })
  return { error: error?.message ?? null }
}
