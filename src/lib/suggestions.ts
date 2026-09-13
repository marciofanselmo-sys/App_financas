import { suggestionInputSchema } from '@/lib/schemas/suggestion'

export type SuggestionStatus = 'nova' | 'lida' | 'em_analise' | 'concluida'

export interface UserSuggestion {
  id: string
  user_id: string
  user_email: string
  message: string
  status: SuggestionStatus
  created_at: string
  updated_at: string
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  nova: 'Nova',
  lida: 'Lida',
  em_analise: 'Em análise',
  concluida: 'Concluída',
}

export const SUGGESTION_STATUS_OPTIONS: SuggestionStatus[] = [
  'nova',
  'lida',
  'em_analise',
  'concluida',
]

export function validateSuggestionMessage(raw: string): { ok: true; message: string } | { ok: false; error: string } {
  const parsed = suggestionInputSchema.safeParse({ message: raw })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Mensagem inválida.' }
  }
  return { ok: true, message: parsed.data.message }
}

export function suggestionStatusClass(status: SuggestionStatus): string {
  switch (status) {
    case 'nova':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
    case 'lida':
      return 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 border-slate-200 dark:border-white/10'
    case 'em_analise':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
    case 'concluida':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
  }
}
