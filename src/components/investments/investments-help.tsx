'use client'

import { useState } from 'react'
import { ChevronRight, Info, Upload, Pin, Pencil, Trash2, Wallet, ArrowDownToLine, Target, TrendingUp, HandCoins, CircleDollarSign, type LucideIcon } from 'lucide-react'
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

/** Explicação da tela de Investimentos — no fim da página, recolhida. */
export function InvestmentsHelp() {
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
            <Item icon={Wallet} title="Patrimônio investido.">
              Vem da planilha de posição da corretora ou de um valor que você informa (&ldquo;Atualizar valor&rdquo;) —
              não é a soma de lançamentos. Muda quando você importa uma posição nova ou atualiza o valor.
            </Item>
            <Item icon={ArrowDownToLine} title="Aportes do mês.">
              Saídas das suas contas marcadas como aporte numa conta de investimento (no extrato, ⋮ → &ldquo;Aporte
              em…&rdquo;, ou pela configuração de Aportes). É comparado com a meta de investir do Planejamento.
            </Item>
            <Item icon={TrendingUp} iconClass="text-green-600" title="Total aportado e rendimento.">
              Por conta: o que já estava aplicado (ponto de partida, se informado) + os aportes. Rendimento = valor
              atual − total aportado. Contas sem aporte configurado ficam de fora dessa conta.
            </Item>
            <Item icon={Target} title="Meta ligada.">
              Uma meta de Metas que puxa o valor de uma destas contas. Para ligar, crie ou edite a meta e escolha
              &ldquo;Vincular conta&rdquo;.
            </Item>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os botões das contas</p>
            <Item icon={Pin} iconClass="text-blue-500" title="Incluir nos relatórios.">
              Com o alfinete azul, a conta entra nos totais dos Relatórios. Investimento nunca entra no Dashboard nem na
              Análise, para não misturar a carteira com o dinheiro do dia a dia.
            </Item>
            <Item icon={HandCoins} title="Aportes.">
              Diz de qual conta e com que texto do extrato sai o dinheiro para esta conta, e o ponto de partida. Mostra
              a lista do que foi encontrado antes de salvar. O saldo das contas não muda.
            </Item>
            <Item icon={CircleDollarSign} title="Atualizar valor.">
              Para conta sem planilha (cripto, previdência, Tesouro): você informa o valor e a data, e ele entra no
              patrimônio e na evolução.
            </Item>
            <Item icon={Upload} title="Importar posição.">
              Atualiza os ativos, o patrimônio, os rendimentos a receber e acrescenta um ponto na evolução. Antes de
              salvar, o app mostra o resumo do arquivo para você confirmar.
            </Item>
            <Item icon={Pencil} title="Editar.">
              Muda nome, descrição, ícone e cor. A posição importada não é alterada.
            </Item>
            <Item icon={Trash2} title="Excluir.">
              Apaga a conta e todos os lançamentos dela. O app pede confirmação duas vezes — não dá para desfazer.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
