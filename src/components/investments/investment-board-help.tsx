'use client'

import { useState } from 'react'
import { ChevronRight, Info, Upload, Download, Wallet, PiggyBank, TrendingUp, MoreVertical, Ban, type LucideIcon } from 'lucide-react'
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

/**
 * "Como funciona" da tela de UMA conta de investimento (RICO, Binance…).
 * Separado do de Contas e Cartões: aqui não há lançamento próprio — o valor
 * vem da posição e o dinheiro aplicado vem das suas contas como aporte.
 */
export function InvestmentBoardHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4 mt-6">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center gap-2 text-left">
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os números</p>
            <Item icon={Wallet} title="Patrimônio.">
              Quanto a conta vale hoje. Com extrato (planilha de posição ou &ldquo;Atualizar valor&rdquo;), vale o
              extrato. Sem extrato, vale a soma dos aportes. Nunca os dois somados. É este valor que entra no
              patrimônio do Dashboard.
            </Item>
            <Item icon={PiggyBank} iconClass="text-blue-600" title="Aportes recebidos.">
              Saídas das suas contas (C6, Itaú…) marcadas como aporte nesta conta. Elas continuam na conta de onde
              saíram — aqui só aparecem. Por isso nada conta duas vezes no seu patrimônio.
            </Item>
            <Item icon={TrendingUp} iconClass="text-green-600" title="Total aportado e rendimento.">
              Total aportado = ponto de partida (o que já estava aplicado, se informado) + os aportes. Rendimento =
              patrimônio − total aportado. Fica mais preciso quanto mais recente for a posição.
            </Item>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O que dá para fazer</p>
            <Item icon={Upload} title="Atualizar posição.">
              Importa a planilha de posição da corretora: atualiza ativos, patrimônio e rendimentos a receber.
            </Item>
            <Item icon={MoreVertical} title="Menu ⋮ de cada aporte.">
              &ldquo;Mudar aporte para…&rdquo; leva o aporte para outra conta de investimento (sai desta na hora);
              &ldquo;Não é aporte&rdquo; tira daqui; &ldquo;Abrir em…&rdquo; leva ao extrato de onde ele saiu, para
              editar categoria, valor ou data.
            </Item>
            <Item icon={Ban} title="Sem lançamento próprio.">
              Conta de investimento não tem &ldquo;Nova transação&rdquo;: o dinheiro sempre vem de uma conta sua. Para
              marcar um aporte, vá ao extrato dessa conta e use ⋮ → &ldquo;Aporte em…&rdquo;.
            </Item>
            <Item icon={Download} title="Exportar CSV.">
              Baixa os lançamentos que estiverem nesta conta, se houver. Disponível nos planos pagos.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
