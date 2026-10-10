import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Cookie anônimo que identifica o navegador, para contar pessoas e não só cliques. */
export const COOKIE_VISITANTE = 'nobli_vid'

// Robôs que abrem o link para montar a prévia (Instagram/Facebook, WhatsApp…)
// e ferramentas de teste. O navegador do Instagram ("Instagram 3xx") é gente
// de verdade e conta.
const ROBO = /bot|crawl|spider|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|slack|discord|preview|curl|wget|python|headless/i

/**
 * Registra um clique num link do teste. Nunca atrapalha o redirecionamento:
 * sem a tabela (migração não rodada) ou com erro, só não conta.
 * Devolve o id do visitante para o cookie (novo ou o que já existia).
 */
export async function registrarClique(req: NextRequest, origem: Record<string, string>, logado: boolean): Promise<string | null> {
  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || ROBO.test(ua)) return null
  const visitante = req.cookies.get(COOKIE_VISITANTE)?.value || crypto.randomUUID()
  try {
    const { error } = await createAdminClient().from('link_cliques').insert({
      visitante,
      utm_source: origem.utm_source ?? null,
      utm_medium: origem.utm_medium ?? null,
      utm_campaign: origem.utm_campaign ?? null,
      utm_content: origem.utm_content ?? null,
      logado,
    })
    if (error) console.warn('[cliques]', error.message)
  } catch { /* sem chave de serviço: só não conta */ }
  return visitante
}
