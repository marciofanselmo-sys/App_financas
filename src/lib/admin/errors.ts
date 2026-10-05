/** Erros do app agrupados por tipo, com o status que o admin deu a cada tipo. */
export interface AppError {
  id: string
  user_id: string | null
  created_at: string
  context: string
  message: string | null
  code: string | null
  route: string | null
}

export type StatusGravado = 'novo' | 'analise' | 'resolvido' | 'ignorado'
/** 'voltou' não é gravado: é um resolvido que aconteceu de novo depois da data. */
export type StatusErro = StatusGravado | 'voltou'

export interface RegistroStatus {
  fingerprint: string
  status: StatusGravado
  note: string | null
  resolved_at: string | null
  updated_at: string
  /** Preenchidos quando o erro foi mandado para o Claude (migration_admin_claude.sql). */
  claude_ref?: string | null
  claude_session_url?: string | null
  claude_sent_at?: string | null
  pr_url?: string | null
}

export interface GrupoErro {
  fingerprint: string
  context: string
  message: string
  count: number
  users: Set<string>
  routes: Set<string>
  last: string
  status: StatusErro
  registro: RegistroStatus | null
  /** Ocorrências depois de marcado como resolvido. */
  depoisDeResolvido: number
}

export const fingerprintDe = (context: string, message: string | null) => `${context}|${message ?? ''}`

/**
 * O mesmo erro 40 vezes com 3 usuários vira UMA linha dizendo isso — 40
 * linhas iguais esconderiam o que importa, que é quantas pessoas foram
 * afetadas. Um tipo resolvido que voltou a acontecer depois da data em que
 * foi resolvido aparece como 'voltou'.
 */
export function agruparErros(errors: AppError[], registros: RegistroStatus[]): GrupoErro[] {
  const statusDe = new Map(registros.map(r => [r.fingerprint, r]))
  const grupos = new Map<string, GrupoErro>()
  for (const e of errors) {
    const fp = fingerprintDe(e.context, e.message)
    const reg = statusDe.get(fp) ?? null
    const g = grupos.get(fp) ?? {
      fingerprint: fp, context: e.context, message: e.message ?? '', count: 0,
      users: new Set<string>(), routes: new Set<string>(), last: e.created_at,
      status: reg?.status ?? 'novo', registro: reg, depoisDeResolvido: 0,
    }
    g.count++
    if (e.user_id) g.users.add(e.user_id)
    if (e.route) g.routes.add(e.route)
    if (e.created_at > g.last) g.last = e.created_at
    if (reg?.status === 'resolvido' && reg.resolved_at && e.created_at > reg.resolved_at) g.depoisDeResolvido++
    grupos.set(fp, g)
  }
  for (const g of grupos.values()) if (g.depoisDeResolvido > 0) g.status = 'voltou'

  const ordem: Record<StatusErro, number> = { voltou: 0, novo: 1, analise: 2, resolvido: 3, ignorado: 4 }
  return [...grupos.values()].sort((a, b) => ordem[a.status] - ordem[b.status] || b.last.localeCompare(a.last))
}

export const ABERTOS: StatusErro[] = ['voltou', 'novo', 'analise']
