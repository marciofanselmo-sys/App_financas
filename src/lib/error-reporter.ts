import { createClient } from '@/lib/supabase/client'

/**
 * Registra um erro na tabela app_errors, para o admin enxergar.
 *
 * Existe porque, sem ele, o erro aparece para o usuário e morre ali: o dono do
 * app só descobre se o usuário for atrás. Foi o que aconteceu quando o worker
 * do pdf.js quebrou toda importação de PDF.
 *
 * Regras que este módulo não pode quebrar, em ordem de importância:
 *
 * 1. NUNCA lança exceção nem rejeita promessa. Um erro ao registrar um erro
 *    não pode derrubar a tela que só queria avisar alguma coisa.
 * 2. NUNCA chama a si mesmo. Se a gravação falhar, ela falha em silêncio — e
 *    não passa por logSafeError, que chamaria reportError de novo, em loop.
 * 3. Não inunda a tabela. Um erro dentro de um laço de renderização dispararia
 *    centenas de vezes por segundo: o mesmo erro é registrado uma vez por
 *    minuto, e cada aba grava no máximo MAX_PER_SESSION registros.
 * 4. Não grava dado do usuário. Só contexto, mensagem técnica e rota — o
 *    chamador nunca deve passar conteúdo de transação (LGPD).
 */

const MAX_PER_SESSION = 30
const DEDUPE_MS = 60_000
const MAX_MESSAGE = 500

let sentThisSession = 0
const lastSent = new Map<string, number>()

function describe(error: unknown): { message: string; code: string | null } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, code: null }
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; code?: unknown }
    return {
      message: e.message != null ? String(e.message) : JSON.stringify(error),
      code: e.code != null ? String(e.code) : null,
    }
  }
  return { message: String(error), code: null }
}

export function reportError(context: string, error: unknown): void {
  // Só no navegador e só em produção: em desenvolvimento o console já mostra
  // tudo, e gravar lá encheria a tabela de erro de quem está programando.
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production') return
  if (sentThisSession >= MAX_PER_SESSION) return

  let described: { message: string; code: string | null }
  try {
    described = describe(error)
  } catch {
    return
  }

  const key = `${context}|${described.message}`
  const now = Date.now()
  const last = lastSent.get(key)
  if (last !== undefined && now - last < DEDUPE_MS) return
  lastSent.set(key, now)
  sentThisSession++

  // Sem await e sem nada que possa propagar: o chamador segue a vida.
  void (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // Sem sessão não há como gravar (a policy exige o próprio user_id).
      if (!user) return
      await supabase.from('app_errors').insert({
        user_id: user.id,
        context: context.slice(0, 120),
        message: described.message.slice(0, MAX_MESSAGE),
        code: described.code,
        route: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 300),
      })
    } catch {
      // Silêncio proposital — ver regra 2 no topo.
    }
  })()
}
