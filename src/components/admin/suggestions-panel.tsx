'use client'

import { useMemo, useState } from 'react'
import { useAdminSuggestions } from '@/hooks/use-user-suggestions'
import {
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_OPTIONS,
  SuggestionStatus,
  suggestionStatusClass,
} from '@/lib/suggestions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SuggestionsPanelProps {
  enabled: boolean
}

export function SuggestionsPanel({ enabled }: SuggestionsPanelProps) {
  const { suggestions, loading, updateStatus } = useAdminSuggestions(enabled)
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? suggestions
        : suggestions.filter(s => s.status === statusFilter),
    [suggestions, statusFilter],
  )

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: suggestions.length }
    for (const s of suggestions) {
      map[s.status] = (map[s.status] ?? 0) + 1
    }
    return map
  }, [suggestions])

  async function handleStatusChange(id: string, status: SuggestionStatus) {
    setUpdatingId(id)
    await updateStatus(id, status)
    setUpdatingId(null)
  }

  if (!enabled) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Sugestões dos usuários
          </h2>
          <span className="text-xs text-slate-400">({suggestions.length})</span>
        </div>
        <div className="sm:ml-auto flex flex-wrap gap-2">
          {(['all', ...SUGGESTION_STATUS_OPTIONS] as const).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                statusFilter === key
                  ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400'
              }`}
            >
              {key === 'all' ? 'Todas' : SUGGESTION_STATUS_LABELS[key]}
              {' '}
              ({counts[key] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nenhuma sugestão neste filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-5 py-3 font-medium min-w-[240px]">Mensagem</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(item => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(item.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                    {item.user_email}
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-w-md">
                    {item.message}
                  </td>
                  <td className="px-5 py-3 min-w-[140px]">
                    <Select
                      value={item.status}
                      onValueChange={v => handleStatusChange(item.id, v as SuggestionStatus)}
                      disabled={updatingId === item.id}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUGGESTION_STATUS_OPTIONS.map(status => (
                          <SelectItem key={status} value={status}>
                            {SUGGESTION_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span
                      className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${suggestionStatusClass(item.status)}`}
                    >
                      {SUGGESTION_STATUS_LABELS[item.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
