'use client'

import { useState } from 'react'
import { useUserSuggestions } from '@/hooks/use-user-suggestions'
import { SUGGESTION_STATUS_LABELS, suggestionStatusClass } from '@/lib/suggestions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MessageSquarePlus, CheckCircle2, Loader2, Inbox } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function SuggestionsPage() {
  const { suggestions, loading, submitSuggestion } = useUserSuggestions()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess(false)
    const result = await submitSuggestion(message)
    setSending(false)
    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Erro ao enviar.')
      return
    }
    setMessage('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 5000)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <MessageSquarePlus className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Sugestões</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Conte o que podemos melhorar — lemos todas as mensagens.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm p-5 space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="suggestion-message">Sua sugestão</Label>
          <textarea
            id="suggestion-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Ex: Gostaria de filtrar despesas por semana no dashboard..."
            rows={5}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-y min-h-[120px]"
          />
          <p className="text-[11px] text-slate-400 text-right">{message.trim().length}/2000</p>
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Recebemos sua sugestão. Obrigado!
          </div>
        )}

        <Button type="submit" disabled={sending || message.trim().length < 3} className="gap-2">
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar sugestão
        </Button>
      </form>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suas sugestões enviadas</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma sugestão enviada ainda.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {suggestions.map(item => (
              <li key={item.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <time className="text-xs text-slate-400">
                    {format(new Date(item.created_at), "d 'de' MMM yyyy · HH:mm", { locale: ptBR })}
                  </time>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${suggestionStatusClass(item.status)}`}
                  >
                    {SUGGESTION_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
