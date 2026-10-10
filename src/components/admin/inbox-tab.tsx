'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { INBOX_EVENTO } from '@/hooks/use-inbox-unread'
import type { EmailCompleto, EmailResumo } from '@/lib/email/inbox'
import { Mail, MailOpen, Paperclip, Download, ArrowLeft, Loader2, RefreshCw, Reply, Send, CheckCircle2 } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AvisoMigration, Carregando, Erro } from './admin-ui'

type Item = EmailResumo & { lido: boolean; respondidoEm: string | null }

/** "Fulano <a@b.com>" → "Fulano"; sem nome, o e-mail. */
function nomeDe(from: string) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<.+>\s*$/)
  return m ? m[1] : from
}
function enderecoDe(from: string) {
  return from.match(/<([^>]+)>/)?.[1] ?? from
}
function quando(iso: string) {
  const d = new Date(iso)
  return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM/yy', { locale: ptBR })
}

/**
 * O HTML do e-mail vem de fora: abre num iframe isolado, sem scripts, e os
 * links saem em aba nova. Assim nada do e-mail roda dentro do painel.
 */
function corpoSeguro(email: EmailCompleto) {
  const base = '<base target="_blank"><meta charset="utf-8"><style>body{font-family:Inter,system-ui,sans-serif;font-size:14px;color:#1e293b;margin:16px;word-break:break-word}img{max-width:100%;height:auto}</style>'
  if (email.html) return base + email.html
  const texto = (email.text ?? '(e-mail sem conteúdo)').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  return `${base}<pre style="white-space:pre-wrap;font-family:inherit">${texto}</pre>`
}

export function InboxTab({ refreshKey }: { refreshKey: number }) {
  const [emails, setEmails] = useState<Item[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [semMarcacao, setSemMarcacao] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'naoLidos'>('todos')
  const [aberto, setAberto] = useState<EmailCompleto | null>(null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  // Resposta: null = fechada; texto = caixa aberta com o rascunho.
  const [resposta, setResposta] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null)
  const [erroResposta, setErroResposta] = useState<string | null>(null)
  const [semRespostas, setSemRespostas] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    const res = await fetch('/api/admin/inbox', { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setErro(body.error ?? 'Não foi possível ler a caixa de entrada.')
    else { setEmails(body.emails); setSemMarcacao(!!body.semMarcacao); setSemRespostas(!!body.semRespostas) }
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar, refreshKey])

  async function abrir(e: Item) {
    setAbrindo(e.id)
    setErro(null)
    const res = await fetch(`/api/admin/inbox/${encodeURIComponent(e.id)}`, { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    setAbrindo(null)
    if (!res.ok) { setErro(body.error ?? 'Não foi possível abrir o e-mail.'); return }
    setAberto(body.email)
    setResposta(null)
    setEnviadoPara(null)
    setErroResposta(null)
    if (!e.lido) {
      setEmails(lista => lista?.map(x => x.id === e.id ? { ...x, lido: true } : x) ?? null)
      window.dispatchEvent(new Event(INBOX_EVENTO))
    }
  }

  async function marcarNaoLido(id: string) {
    const res = await fetch(`/api/admin/inbox/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lido: false }),
    })
    if (!res.ok) { setErro('Não foi possível marcar como não lido.'); return }
    setEmails(lista => lista?.map(x => x.id === id ? { ...x, lido: false } : x) ?? null)
    setAberto(null)
    window.dispatchEvent(new Event(INBOX_EVENTO))
  }

  async function enviarResposta() {
    if (!aberto || !resposta?.trim()) return
    setEnviando(true)
    setErroResposta(null)
    const res = await fetch(`/api/admin/inbox/${encodeURIComponent(aberto.id)}/responder`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagem: resposta }),
    })
    const body = await res.json().catch(() => ({}))
    setEnviando(false)
    // Erro aparece junto da caixa de resposta, não no topo da página.
    if (!res.ok) { setErroResposta(body.error ?? 'Não foi possível enviar a resposta.'); return }
    setResposta(null)
    setEnviadoPara(body.para)
    const id = aberto.id
    setEmails(lista => lista?.map(x => x.id === id ? { ...x, respondidoEm: body.respondidoEm ?? new Date().toISOString() } : x) ?? null)
  }

  const visiveis = useMemo(
    () => (emails ?? []).filter(e => filtro === 'todos' || !e.lido),
    [emails, filtro],
  )
  const naoLidos = (emails ?? []).filter(e => !e.lido).length

  if (carregando && !emails) return <Carregando />

  return (
    <div className="space-y-4">
      {semMarcacao && (
        <AvisoMigration arquivo="migration_admin_inbox.sql" oQue="Dá para ler os e-mails, mas o painel ainda não guarda quais já foram lidos." />
      )}
      {semRespostas && (
        <AvisoMigration arquivo="migration_admin_inbox_replies.sql" oQue="As respostas são enviadas, mas o painel ainda não guarda quais e-mails já foram respondidos." />
      )}
      {erro && <Erro msg={erro} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
        {/* Lista — no celular some quando um e-mail está aberto */}
        <OverviewSection icon={Mail} title="Caixa de entrada" subtitle="contato@noblifinance.com.br · via Resend"
          className={aberto ? 'hidden lg:block' : undefined}>
          <div className="flex items-center gap-2 mt-3">
            {([['todos', `Todos (${emails?.length ?? 0})`], ['naoLidos', `Não lidos (${naoLidos})`]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${filtro === k
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400'}`}>
                {label}
              </button>
            ))}
            <button type="button" onClick={carregar} title="Buscar e-mails novos"
              className="ml-auto h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5">
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!erro && visiveis.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              {filtro === 'naoLidos' ? 'Nenhum e-mail novo.' : 'Nenhum e-mail recebido ainda.'}
            </p>
          ) : (
            <ul className="mt-3 -mx-5 divide-y divide-slate-100 dark:divide-white/[0.06]">
              {visiveis.map(e => (
                <li key={e.id}>
                  <button type="button" onClick={() => abrir(e)}
                    className={`w-full text-left px-5 py-3 flex gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] ${aberto?.id === e.id ? 'bg-blue-50/70 dark:bg-blue-500/10' : ''}`}>
                    <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${e.lido ? 'bg-transparent' : 'bg-blue-600'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className={`truncate text-sm ${e.lido ? 'text-slate-600 dark:text-slate-300' : 'font-semibold text-slate-900 dark:text-slate-100'}`}>{nomeDe(e.from)}</span>
                        <span className="ml-auto text-[11px] text-slate-400 shrink-0">{quando(e.created_at)}</span>
                      </span>
                      <span className={`flex items-center gap-1 text-sm truncate ${e.lido ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {e.anexos > 0 && <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />}
                        <span className="truncate">{e.subject || '(sem assunto)'}</span>
                      </span>
                      {e.respondidoEm && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          <Reply className="h-3 w-3" /> Respondido · {quando(e.respondidoEm)}
                        </span>
                      )}
                    </span>
                    {abrindo === e.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0 mt-1" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </OverviewSection>

        {/* Leitura */}
        <section className={`bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden ${aberto ? '' : 'hidden lg:flex lg:items-center lg:justify-center lg:min-h-[320px]'}`}>
          {!aberto ? (
            <p className="text-sm text-slate-400 flex items-center gap-2"><MailOpen className="h-4 w-4" /> Escolha um e-mail para ler</p>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] space-y-2">
                <button type="button" onClick={() => setAberto(null)} className="lg:hidden inline-flex items-center gap-1 text-xs text-slate-500 mb-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 break-words">{aberto.subject || '(sem assunto)'}</h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                  <p><b className="text-slate-700 dark:text-slate-200">{nomeDe(aberto.from)}</b> &lt;{enderecoDe(aberto.from)}&gt;</p>
                  <p>Para: {aberto.to.join(', ')}{aberto.cc.length ? ` · Cc: ${aberto.cc.join(', ')}` : ''}</p>
                  <p>{format(new Date(aberto.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => { setResposta(r => r ?? ''); setEnviadoPara(null) }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                    <Reply className="h-3.5 w-3.5" /> Responder
                  </button>
                  <button type="button" onClick={() => marcarNaoLido(aberto.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                    <Mail className="h-3.5 w-3.5" /> Marcar como não lido
                  </button>
                  {aberto.raw_url && (
                    <a href={aberto.raw_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                      <Download className="h-3.5 w-3.5" /> Original{aberto.attachments.length ? ' com anexos' : ''}
                    </a>
                  )}
                </div>
                {aberto.attachments.length > 0 && (
                  <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                    {aberto.attachments.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{a.filename} <span className="text-slate-400">({Math.max(1, Math.round(a.size / 1024))} KB)</span></span>
                    ))}
                  </p>
                )}
              </div>
              {(() => {
                const respondidoEm = emails?.find(x => x.id === aberto.id)?.respondidoEm
                if (!enviadoPara && !respondidoEm) return null
                return (
                  <p className="mx-5 mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {enviadoPara
                      ? <>Resposta enviada para {enviadoPara}.</>
                      : <>Respondido em {format(new Date(respondidoEm!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.</>}
                  </p>
                )
              })()}
              {resposta !== null && (
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Para <b className="text-slate-700 dark:text-slate-200">{enderecoDe(aberto.reply_to[0] ?? aberto.from)}</b> · sai de contato@noblifinance.com.br com a mensagem original citada embaixo
                  </p>
                  <textarea autoFocus value={resposta} onChange={e => setResposta(e.target.value)} rows={7}
                    placeholder="Escreva a resposta…"
                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  {erroResposta && <Erro msg={erroResposta} />}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={enviarResposta} disabled={enviando || !resposta.trim()}
                      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
                    </button>
                    <button type="button" onClick={() => setResposta(null)} disabled={enviando}
                      className="text-sm px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5">
                      Cancelar
                    </button>
                    <span className="ml-auto text-[11px] text-slate-400">Assinada como “Equipe NOBLI”</span>
                  </div>
                </div>
              )}
              <iframe
                title="Conteúdo do e-mail"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={corpoSeguro(aberto)}
                className="w-full min-h-[480px] flex-1 bg-white"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
