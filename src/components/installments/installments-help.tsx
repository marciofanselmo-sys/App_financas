'use client'

import { useState } from 'react'
import { ChevronRight, Info, CreditCard, Wallet, TrendingDown, CalendarCheck, CalendarClock, Plus, Trash2, ListFilter, ScanSearch, type LucideIcon } from 'lucide-react'
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

/** Explicação da tela Cartões & Parcelas — no fim da página, recolhida (mesmo padrão das outras telas). */
export function InstallmentsHelp() {
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os números</p>
            <Item icon={CreditCard} iconClass="text-violet-600" title="Parcelas / mês.">
              A soma de UMA parcela de cada compra que ainda tem parcela por vir — quanto sai do seu bolso todo mês
              até cada parcelamento terminar.
            </Item>
            <Item icon={Wallet} title="Falta pagar.">
              Tudo o que ainda vai cair, somando as parcelas futuras de todos os parcelamentos ativos.
            </Item>
            <Item icon={TrendingDown} iconClass="text-green-600" title="Alivia em.">
              Quanto deixa de sair no mês que vem, porque esses parcelamentos terminam neste mês.
            </Item>
            <Item icon={CalendarCheck} title="Fica livre em.">
              O mês da última parcela das compras que você já fez. Compra nova parcelada muda esse mês.
            </Item>
            <Item icon={CalendarClock} iconClass="text-violet-600" title="Gráfico e Por cartão.">
              Mostram, mês a mês e por cartão, quanto já está comprometido. O cartão é a conta onde a parcela foi
              lançada; sem conta, ela aparece em &ldquo;Sem cartão&rdquo;.
            </Item>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O que dá para fazer</p>
            <Item icon={ScanSearch} title="Detecção automática.">
              Compras parceladas aparecem sozinhas quando você importa o extrato (parcela 3/10, por exemplo). Não é
              uma lista do mês: acompanha cada parcelamento do primeiro ao último pagamento.
            </Item>
            <Item icon={ListFilter} title="Filtrar e ordenar.">
              Escolha um cartão nos botões acima da lista, ou ordene por quem termina primeiro, maior valor por mês ou
              maior total restante.
            </Item>
            <Item icon={Plus} iconClass="text-blue-600" title="Nova parcela.">
              Para um parcelamento que não veio no extrato: informe o nome, a parcela atual, o total, o valor e o cartão.
            </Item>
            <Item icon={Trash2} title="Lixeira.">
              Tira o parcelamento desta lista. Não apaga nenhuma transação da sua conta.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
