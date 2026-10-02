import { suggestionInputSchema } from '@/lib/schemas/suggestion'

export type SuggestionStatus = 'nova' | 'lida' | 'em_analise' | 'concluida'
export type SuggestionKind = 'ideia' | 'problema' | 'duvida' | 'elogio'

export interface UserSuggestion {
  id: string
  user_id: string
  user_email: string
  message: string
  status: SuggestionStatus
  /** Colunas de migration_suggestions_kind_reply.sql — ausentes antes dela rodar. */
  kind?: SuggestionKind | null
  screen?: string | null
  admin_reply?: string | null
  replied_at?: string | null
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

export const SUGGESTION_KIND_OPTIONS: SuggestionKind[] = ['ideia', 'problema', 'duvida', 'elogio']

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  ideia: 'Ideia',
  problema: 'Problema',
  duvida: 'Dúvida',
  elogio: 'Elogio',
}

export function suggestionKindClass(kind: SuggestionKind): string {
  switch (kind) {
    case 'ideia':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
    case 'problema':
      return 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
    case 'duvida':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
    case 'elogio':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
}

/** Telas que o usuário pode apontar na sugestão (mesmos nomes do menu). */
export const SUGGESTION_SCREENS = [
  'Geral', 'Dashboard', 'Análise', 'Relatórios', 'Contas e Cartões', 'Importar extrato',
  'Investimentos', 'Planejamento', 'Metas', 'Cartões & Parcelas', 'Recorrências',
  'Categorias e regras', 'Minha conta e plano',
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
