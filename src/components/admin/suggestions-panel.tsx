'use client'

import { useMemo, useState } from 'react'
import { useAdminSuggestions } from '@/hooks/use-user-suggestions'
import {
  SUGGESTION_KIND_LABELS,
  SUGGESTION_KIND_OPTIONS,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_OPTIONS,
  SuggestionKind,
  SuggestionStatus,
  UserSuggestion,
  suggestionKindClass,
  suggestionStatusClass,
} from '@/lib/suggestions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Loader2, MessageSquareReply } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface SuggestionsPanelProps {
  enabled: boolean
}

export function SuggestionsPanel({ enabled }: SuggestionsPanelProps) {
  const { suggestions, loading, updateStatus, updateReply } = useAdminSuggestions(enabled)
  const [statusFilter, setStatusFilter] = useState<'all' | SuggestionStatus>('all')
  const [kindFilter, setKindFilter] = useState<'all' | SuggestionKind>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      suggestions.filter(s =>
        (statusFilter === 'all' || s.status === statusFilter) &&
        (kindFilter === 'all' || s.kind === kindFilter)),
    [suggestions, statusFilter, kindFilter],
  )
  const kindCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of suggestions) if (s.kind) map[s.kind] = (map[s.kind] ?? 0) + 1
    return map
  }, [suggestions])

  async function handleReply(id: string, reply: string) {
    setErro(null)
    const res = await updateReply(id, reply)
    if (res.error) setErro(`Não foi possível salvar a resposta: ${res.error}`)
    return !res.error
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: suggestions.length }
    for (const s of suggestions) {
      map[s.status] = (map[s.status] ?? 0) + 1
    }
    return map
  }, [suggestions])

  async function handleStatusChange(id: string, status: SuggestionStatus) {
    setUpdatingId(id)
    setErro(null)
    const res = await updateStatus(id, status)
    setUpdatingId(null)
    // Sem isto, a falha só fazia o select voltar ao valor antigo, sem aviso.
    if (res.error) setErro(`Não foi possível mudar o status: ${res.error}`)
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

      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        <span className="text-[11px] text-slate-400">Tipo:</span>
        {(['all', ...SUGGESTION_KIND_OPTIONS] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setKindFilter(key)}
            className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              kindFilter === key
                ? 'bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400'
            }`}
          >
            {key === 'all' ? 'Todos' : SUGGESTION_KIND_LABELS[key]} ({key === 'all' ? suggestions.length : kindCounts[key] ?? 0})
          </button>
        ))}
      </div>

      {erro && (
        <p className="mx-5 mt-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

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
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-200 max-w-md">
                    {(item.kind || item.screen) && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {item.kind && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${suggestionKindClass(item.kind)}`}>
                            {SUGGESTION_KIND_LABELS[item.kind]}
                          </span>
                        )}
                        {item.screen && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">{item.screen}</span>
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{item.message}</p>
                    <ReplyEditor item={item} onSave={handleReply} />
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

// Resposta da equipe: aparece para o usuário embaixo da sugestão.
function ReplyEditor({ item, onSave }: { item: UserSuggestion; onSave: (id: string, reply: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.admin_reply ?? '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return item.admin_reply ? (
      <div className="mt-2 rounded-lg border-l-[3px] border-blue-600 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
        <strong className="text-blue-700 dark:text-blue-400">Sua resposta</strong>
        {item.replied_at && <span className="text-slate-400"> · {format(new Date(item.replied_at), 'dd/MM/yy', { locale: ptBR })}</span>}
        <p className="mt-0.5 whitespace-pre-wrap">{item.admin_reply}</p>
        <button type="button" onClick={() => { setText(item.admin_reply ?? ''); setEditing(true) }} className="mt-1 text-[11px] font-medium text-blue-600 hover:underline">Editar resposta</button>
      </div>
    ) : (
      <button type="button" onClick={() => setEditing(true)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline">
        <MessageSquareReply className="h-3.5 w-3.5" /> Responder
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="A resposta aparece para o usuário embaixo da sugestão."
        className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-2.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            const ok = await onSave(item.id, text)
            setSaving(false)
            if (ok) setEditing(false)
          }}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />} Salvar resposta
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-slate-500 hover:underline">Cancelar</button>
        {item.admin_reply && <span className="text-[10px] text-slate-400">Deixe vazio e salve para apagar.</span>}
      </div>
    </div>
  )
}
