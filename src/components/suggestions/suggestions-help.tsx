'use client'

import { useState } from 'react'
import { ChevronRight, Info, Lightbulb, LayoutGrid, Route, MessageSquareReply, Send, ListFilter, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function Item({ icon: Icon, iconClass, title, children }: { icon: LucideIcon; iconClass?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
        <Icon className={cn('h-3.5 w-3.5 text-slate-400', iconClass)} />
      </span>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <strong className="text-slate-700 dark:text-slate-200">{title}</strong>{' '}{children}
      </p>
    </div>
  )
}

/** Explicação da tela Sugestões — no fim da página, recolhida (mesmo padrão das outras telas). */
export function SuggestionsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Enviar</p>
            <Item icon={Lightbulb} iconClass="text-blue-600" title="Tipo.">
              Diga se é uma ideia, um problema, uma dúvida ou um elogio — ajuda a equipe a priorizar.
            </Item>
            <Item icon={LayoutGrid} title="Tela.">
              Escolha a tela de que você está falando, ou &ldquo;Geral&rdquo; se for sobre o app todo.
            </Item>
            <Item icon={Send} title="Mensagem.">
              Até 2000 caracteres. Os atalhos (&ldquo;Seria ótimo se…&rdquo;) só ajudam a começar a frase.
            </Item>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Acompanhar</p>
            <Item icon={Route} iconClass="text-blue-600" title="Status.">
              Cada sugestão mostra onde está: Nova, Lida, Em análise ou Concluída. Os números do topo somam esses status.
            </Item>
            <Item icon={MessageSquareReply} iconClass="text-green-600" title="Resposta da equipe.">
              Quando a equipe responder, a resposta aparece embaixo da sugestão.
            </Item>
            <Item icon={ListFilter} title="Filtros.">
              Veja todas, só as em andamento ou só as concluídas.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
