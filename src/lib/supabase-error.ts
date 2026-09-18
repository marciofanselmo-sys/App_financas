import { reportError } from '@/lib/error-reporter'

const PG_LEAK_PATTERN = /postgres|duplicate key|null value|violates|relation|column|schema|hint|details|RLS|policy/i

/** Mensagens genéricas ao usuário — evita vazar detalhes do Postgres (12.21) */
export function formatUserError(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message: unknown }).message)
    if (/password|senha/i.test(msg)) return msg
    if (/network|fetch|timeout/i.test(msg)) return 'Falha de conexão. Verifique sua internet.'
    if (PG_LEAK_PATTERN.test(msg)) return fallback
  }
  return fallback
}

/**
 * Log seguro — detalhes só em desenvolvimento.
 *
 * Também registra o erro em app_errors para o admin ver. Como esta função já é
 * chamada em todos os pontos de falha importantes do app, registrar aqui cobre
 * quase tudo de uma vez, sem espalhar chamadas novas pelo código.
 */
export function logSafeError(context: string, error: unknown) {
  reportError(context, error)
  if (process.env.NODE_ENV === 'production') {
    console.error(`[${context}]`, error instanceof Error ? error.name : 'Error')
    return
  }
  console.error(`[${context}]`, error)
}
