'use client'

import { useState } from 'react'
import { ChevronRight, Info, Tag, ArrowLeftRight, PiggyBank, Zap, ListOrdered, FlaskConical, AlertTriangle, type LucideIcon } from 'lucide-react'
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

/** Explicação da tela de Regras — no fim da página, recolhida (mesmo padrão das outras telas). */
export function RulesHelp() {
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os três tipos de regra</p>
            <Item icon={Tag} iconClass="text-blue-600" title="Categoria.">
              Decide a categoria pelo texto da descrição. O lançamento continua sendo gasto ou receita.
            </Item>
            <Item icon={ArrowLeftRight} title="Entre minhas contas.">
              Diz que o lançamento só mudou de conta (fatura, TED para conta sua). Sai dos totais de gasto e receita; o saldo não muda.
            </Item>
            <Item icon={PiggyBank} iconClass="text-indigo-600" title="Aporte.">
              É um &ldquo;entre minhas contas&rdquo; com destino numa conta de investimento: sai dos gastos e soma como aporte nela.
            </Item>
            <Item icon={ListOrdered} title="Juntas na importação.">
              Um lançamento pode passar por mais de uma: a regra de categoria dá a categoria, e a de entre contas ou aporte tira dos totais.
              Entre regras de categoria, vale a primeira criada que combinar.
            </Item>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O que dá para fazer</p>
            <Item icon={Zap} iconClass="text-violet-500" title="Regras automáticas.">
              Ao trocar a categoria de um lançamento (em Contas e Cartões ou na Análise), o app cria sozinho uma regra &ldquo;Igual a&rdquo; com aquela descrição.
              Para não criar, marque &ldquo;Mudar só esta transação&rdquo; no formulário.
            </Item>
            <Item icon={AlertTriangle} iconClass="text-amber-500" title="Vale revisar.">
              Mostra regras que não pegam nenhum lançamento, regras de categoria em conflito (uma palavra que engole a outra) e lançamentos em &ldquo;Outros&rdquo;.
            </Item>
            <Item icon={FlaskConical} iconClass="text-green-600" title="Testar uma descrição.">
              Digite um texto como aparece no extrato e veja quais regras ele ativaria, de cada tipo.
            </Item>
            <Item icon={Tag} title="Eventos não entram em regras.">
              Eventos (viagem, reforma) são etiquetas marcadas à mão; nenhuma regra marca ou tira um evento.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
