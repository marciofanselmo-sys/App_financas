'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useUserSuggestions } from '@/hooks/use-user-suggestions'
import {
  SUGGESTION_KIND_LABELS, SUGGESTION_KIND_OPTIONS, SUGGESTION_SCREENS, SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_OPTIONS, SuggestionKind, UserSuggestion, suggestionKindClass,
} from '@/lib/suggestions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Kpi, OverviewSection } from '@/components/ui/overview-blocks'
import { SuggestionsHelp } from '@/components/suggestions/suggestions-help'
import {
  MessageSquarePlus, CheckCircle2, Loader2, Inbox, Lightbulb, Bug, HelpCircle, Heart, Route, type LucideIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<SuggestionKind, LucideIcon> = {
  ideia: Lightbulb,
  problema: Bug,
  duvida: HelpCircle,
  elogio: Heart,
}

const STARTERS = ['Seria ótimo se… ', 'Encontrei um erro em… ', 'Não entendi como… ']

const STEPS: { label: string; text: string }[] = [
  { label: 'Nova', text: 'Chegou para a equipe.' },
  { label: 'Lida', text: 'Alguém leu e entendeu o pedido.' },
  { label: 'Em análise', text: 'Estamos avaliando como fazer.' },
  { label: 'Concluída', text: 'Virou melhoria ou foi respondida.' },
]

type Filter = 'all' | 'open' | 'done'

// ?tipo=duvida (vindo da Ajuda) já abre o formulário com o tipo marcado.
export default function SuggestionsPage() {
  return (
    <Suspense fallback={null}>
      <SuggestionsContent />
    </Suspense>
  )
}

function SuggestionsContent() {
  const params = useSearchParams()
  const tipo = params.get('tipo')
  const initialKind: SuggestionKind = SUGGESTION_KIND_OPTIONS.includes(tipo as SuggestionKind) ? (tipo as SuggestionKind) : 'ideia'
  const { suggestions, loading, submitSuggestion } = useUserSuggestions()
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<SuggestionKind>(initialKind)
  const [screen, setScreen] = useState('Geral')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const by = (st: string) => suggestions.filter(s => s.status === st).length
    return { total: suggestions.length, nova: by('nova'), analise: by('em_analise') + by('lida'), done: by('concluida') }
  }, [suggestions])
  const first = suggestions.length ? suggestions[suggestions.length - 1].created_at : null

  const shown = suggestions.filter(s =>
    filter === 'all' ? true : filter === 'done' ? s.status === 'concluida' : s.status !== 'concluida')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess(false)
    const result = await submitSuggestion(message, { kind, screen })
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Sugestões</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Conte o que podemos melhorar — lemos todas as mensagens.
        </p>
      </div>

      {/* Os quatro números do topo — mesmo padrão das outras telas */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#1d4ed8,#0B2D6B)' }}>
          <p className="text-[11px] uppercase tracking-wide text-blue-100">Enviadas</p>
          <p className="font-heading text-2xl font-extrabold mt-1 tabular-nums">{counts.total}</p>
          <p className="text-[11px] text-blue-100 mt-0.5">
            {first ? `desde ${format(new Date(first), 'MMM/yyyy', { locale: ptBR })}` : 'nenhuma ainda'}
          </p>
        </div>
        <Kpi title="Em análise" value={String(counts.analise)} valueClass="text-amber-600 dark:text-amber-400" sub="a equipe está avaliando" />
        <Kpi title="Concluídas" value={String(counts.done)} valueClass="text-green-600 dark:text-green-400" sub="viraram melhoria ou foram respondidas" />
        <Kpi title="Aguardando leitura" value={String(counts.nova)} sub="ainda não lidas pela equipe" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-stretch">
        <form onSubmit={handleSubmit}>
          <OverviewSection icon={MessageSquarePlus} title="Nova sugestão" subtitle="Quanto mais detalhe, mais rápido a gente entende." className="h-full">
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>O que você quer contar?</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_KIND_OPTIONS.map(k => {
                    const Icon = KIND_ICONS[k]
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                          kind === k
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:border-blue-300',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {SUGGESTION_KIND_LABELS[k]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sobre qual tela?</Label>
                <Select value={screen} onValueChange={v => v && setScreen(v)} items={Object.fromEntries(SUGGESTION_SCREENS.map(s => [s, s]))}>
                  <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUGGESTION_SCREENS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="suggestion-message">Sua mensagem</Label>
                <textarea
                  id="suggestion-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Ex: Gostaria de filtrar despesas por semana no dashboard..."
                  rows={5}
                  maxLength={2000}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-y min-h-[120px]"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {STARTERS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMessage(m => (m.trim() ? m : s))}
                      className="text-[11px] rounded-lg bg-slate-100 dark:bg-white/[0.06] px-2 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]"
                    >
                      {s.trim()}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-slate-400">{message.trim().length}/2000</span>
                </div>
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

              <div className="flex justify-end">
                <Button type="submit" disabled={sending || message.trim().length < 3} className="gap-2">
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar sugestão
                </Button>
              </div>
            </div>
          </OverviewSection>
        </form>

        <OverviewSection icon={Route} title="O que acontece depois" subtitle="O caminho de cada mensagem" className="h-full">
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex gap-3">
                <span className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0',
                  i === STEPS.length - 1
                    ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                )}>{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[11px] text-slate-400">
            Quando a equipe responder, a resposta aparece embaixo da sua sugestão, na lista abaixo.
          </p>
        </OverviewSection>
      </div>

      <section className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Suas sugestões</h2>
          </div>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', `Todas · ${counts.total}`],
                ['open', `Em andamento · ${counts.total - counts.done}`],
                ['done', `Concluídas · ${counts.done}`],
              ] as [Filter, string][]).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    filter === k
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:border-blue-300',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {suggestions.length === 0 ? 'Nenhuma sugestão enviada ainda.' : 'Nenhuma sugestão neste filtro.'}
            </p>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {shown.map(item => <SuggestionItem key={item.id} item={item} />)}
          </ul>
        )}
      </section>

      <SuggestionsHelp />
    </div>
  )
}

function SuggestionItem({ item }: { item: UserSuggestion }) {
  const kind = item.kind ?? null
  const KindIcon = kind ? KIND_ICONS[kind] : null
  const stepIdx = SUGGESTION_STATUS_OPTIONS.indexOf(item.status)
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        {kind && KindIcon && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', suggestionKindClass(kind))}>
            <KindIcon className="h-3 w-3" /> {SUGGESTION_KIND_LABELS[kind]}
          </span>
        )}
        {item.screen && (
          <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 text-slate-600 dark:text-slate-300">{item.screen}</span>
        )}
        <time>{format(new Date(item.created_at), "d 'de' MMM yyyy · HH:mm", { locale: ptBR })}</time>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{item.message}</p>

      {/* Trilha do status: Nova → Lida → Em análise → Concluída */}
      <ol className="mt-3 flex flex-wrap items-center gap-y-1 text-[10.5px]">
        {SUGGESTION_STATUS_OPTIONS.map((st, i) => {
          const reached = i <= stepIdx
          const done = st === 'concluida' && reached
          return (
            <li key={st} className="flex items-center">
              {i > 0 && <span className={cn('h-0.5 w-8 sm:w-12 mx-1.5', reached ? 'bg-blue-600' : 'bg-slate-200 dark:bg-white/[0.1]')} />}
              <span className={cn(
                'inline-flex items-center gap-1.5',
                done ? 'text-green-600 font-semibold' : reached ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400',
              )}>
                <span className={cn('h-2.5 w-2.5 rounded-full', done ? 'bg-green-600' : reached ? 'bg-blue-600' : 'bg-slate-200 dark:bg-white/[0.12]')} />
                {SUGGESTION_STATUS_LABELS[st]}
              </span>
            </li>
          )
        })}
      </ol>

      {item.admin_reply && (
        <div className="mt-3 rounded-lg border-l-[3px] border-blue-600 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          <strong className="text-blue-700 dark:text-blue-400">Resposta da equipe</strong>
          {item.replied_at && <span className="text-slate-400"> · {format(new Date(item.replied_at), "d 'de' MMM", { locale: ptBR })}</span>}
          <p className="mt-0.5 whitespace-pre-wrap">{item.admin_reply}</p>
        </div>
      )}
    </li>
  )
}
