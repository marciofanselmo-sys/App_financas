import { createClient } from '@/lib/supabase/client'

/**
 * Marcos da jornada (tabela product_events, migration_product_events.sql).
 * Mede onde a pessoa para depois do cadastro — o painel Admin mostra o funil.
 */
export type ProductEvent =
  | 'primeira_conta'        // criou a primeira conta ou cartão
  | 'primeira_importacao'   // importou o primeiro extrato
  | 'bloqueio_visto'        // abriu uma tela do plano pago (key = recurso)
  | 'teste_inicio'          // começou o teste de 7 dias (gravado pelo servidor)
  | 'resumo_visto'          // abriu "Seu mês em números" (tarefa 4 da jornada)
  | 'visita'                // abriu o app no dia (key = AAAA-MM-DD; tarefa 10)
  | 'vitrine_clique'        // clicou num cadeado da vitrine (key = recurso)

/** O que já foi enviado nesta aba — evita ir ao banco a cada clique. */
const sent = new Set<string>()

/**
 * Registra um marco uma vez por (evento, chave). Nunca lança e nunca atrasa a
 * tela: falha de rede ou banco sem a migration só deixa de medir.
 */
export function trackEvent(event: ProductEvent, opts: { key?: string; props?: Record<string, unknown> } = {}): void {
  if (typeof window === 'undefined') return
  const key = opts.key ?? ''
  const id = `${event}|${key}`
  if (sent.has(id)) return
  sent.add(id)
  void (async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { sent.delete(id); return }
      // Já registrado antes = conflito ignorado, não é erro.
      await supabase.from('product_events').upsert(
        { user_id: user.id, event, dedupe_key: key, props: opts.props ?? {} },
        { onConflict: 'user_id,event,dedupe_key', ignoreDuplicates: true },
      )
    } catch {
      // medir nunca pode quebrar o app
    }
  })()
}
