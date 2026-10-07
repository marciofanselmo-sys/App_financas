// Usa a chave de serviço: importar só em rotas de API / server components.
import { createAdminClient } from '@/lib/supabase/admin'
import { TRIAL_BASE_DAYS } from '@/lib/trial-config'

type Admin = ReturnType<typeof createAdminClient>

export type InicioTeste = 'iniciado' | 'ja-teve' | 'assinante' | 'falha'

/**
 * Começa o teste de uma conta. Só roda no servidor: é aqui que fica a regra
 * de um teste por e-mail (apagar e recriar a conta não dá outro) e de que
 * quem já paga não entra em teste.
 */
export async function iniciarTeste(
  admin: Admin,
  userId: string,
  email: string,
  origem: Record<string, string> = {},
): Promise<InicioTeste> {
  try {
    const mail = email.trim().toLowerCase()
    const { data: sub } = await admin.from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
    if (sub && ['active', 'past_due'].includes(String(sub.status))) return 'assinante'

    const { data: porConta } = await admin.from('user_trials').select('user_id').eq('user_id', userId).limit(1)
    if (porConta && porConta.length > 0) return 'ja-teve'
    // O e-mail é gravado sempre em minúsculas, então a comparação é exata.
    const { data: porEmail } = await admin.from('user_trials').select('user_id').eq('email', mail).limit(1)
    if (porEmail && porEmail.length > 0) return 'ja-teve'

    const fim = new Date(Date.now() + TRIAL_BASE_DAYS * 24 * 60 * 60 * 1000)
    const { error } = await admin.from('user_trials').insert({
      user_id: userId, email: mail, base_ends_at: fim.toISOString(), origem,
    })
    if (error) {
      // Corrida com outra aba (índice único do e-mail) = já teve.
      if (error.code === '23505') return 'ja-teve'
      console.error('[teste] insert falhou:', error.message)
      return 'falha'
    }
    // Marco do funil (product_events); se a tabela não existir, só não mede.
    await admin.from('product_events').upsert(
      { user_id: userId, event: 'teste_inicio', dedupe_key: '', props: origem },
      { onConflict: 'user_id,event,dedupe_key', ignoreDuplicates: true },
    )
    return 'iniciado'
  } catch (e) {
    console.error('[teste] erro:', e instanceof Error ? e.message : e)
    return 'falha'
  }
}

/** Cookie que marca "veio para o teste" entre o /teste e o cadastro. */
export const COOKIE_TESTE = 'nobli_teste'
