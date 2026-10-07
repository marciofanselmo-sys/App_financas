/**
 * Regras do teste grátis (plano de conversão, decidido em 07/10/2026):
 * 5 dias de teste + até 48 horas de bônus ganhas pela jornada de tarefas.
 * Pode ser importado pelo navegador e pelo servidor.
 */
export const TRIAL_BASE_DAYS = 5
export const TRIAL_MAX_BONUS_HOURS = 48

export interface TrialRow {
  user_id: string
  started_at: string
  base_ends_at: string
  bonus_hours: number
  ended_seen_at: string | null
}

/** Quando o teste termina, já com as horas de bônus somadas. */
export function trialEndsAt(t: Pick<TrialRow, 'base_ends_at' | 'bonus_hours'>): Date {
  return new Date(new Date(t.base_ends_at).getTime() + t.bonus_hours * 60 * 60 * 1000)
}
