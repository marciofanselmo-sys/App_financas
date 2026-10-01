'use client'

import { useState } from 'react'
import {
  ChevronRight, Info, Upload, Download, Plus, RefreshCw, MoreVertical, ArrowLeftRight, SquareCheck, Filter,
  type LucideIcon,
} from 'lucide-react'
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
 * Explicação das funções da tela de uma conta (lançamentos), no fim da
 * página e recolhida por padrão — mesmo padrão de Contas e Cartões.
 */
export function BoardHelp() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-4 mt-6">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left"
      >
        <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funciona esta tela</h2>
      </button>

      {open && (
        <div className="grid gap-6 lg:grid-cols-2 mt-4">
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os botões do topo</p>
            <Item icon={Upload} title="Importar extrato.">
              Traz os lançamentos do arquivo do banco (CSV, OFX, Excel ou o PDF de alguns bancos) para esta conta. O app já
              categoriza pelas suas regras e pelo histórico, e mostra uma revisão antes de salvar.
            </Item>
            <Item icon={Download} title="Exportar CSV.">
              Baixa os lançamentos desta conta numa planilha, escolhendo o período. Disponível nos planos pagos.
            </Item>
            <Item icon={Plus} iconClass="text-blue-600" title="Nova transação.">
              Lança uma entrada ou saída à mão, como um gasto em dinheiro ou algo que não veio no extrato.
            </Item>

            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 pt-1">Os cards e os filtros</p>
            <Item icon={Filter} title="Entradas, Saídas e Saldo do período.">
              Somam só o que está na tabela abaixo: o mês escolhido e os filtros ativos (busca, tipo e categoria).
              Pagamentos de fatura e transferências entre suas contas também entram aqui, porque o dinheiro saiu
              desta conta de verdade. O saldo total da conta, de todo o histórico, fica em Contas e Cartões.
            </Item>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Em cada lançamento</p>
            <Item icon={RefreshCw} iconClass="text-violet-500" title="Fixar / Fixo.">
              Marca o lançamento como gasto fixo do mês (conta de luz, internet, aluguel), e ele passa a aparecer em
              Recorrências. Clique de novo para tirar.
            </Item>
            <Item icon={ArrowLeftRight} title="Entre contas.">
              Etiqueta de dinheiro que só trocou de lugar entre contas suas, como pagar a fatura do cartão com a
              conta corrente. Ele conta no saldo da conta, mas não soma como gasto nem como ganho na Análise, nos
              Relatórios e no Planejamento.
            </Item>
            <Item icon={MoreVertical} title="Menu ⋮.">
              <span className="block mt-0.5">
                <b className="font-medium text-slate-600 dark:text-slate-300">Editar</b>{' '}muda descrição, valor, data,
                categoria e tipo. Ao trocar a categoria, todos os lançamentos com a mesma descrição mudam juntos e os
                próximos já chegam assim — a não ser que você marque &ldquo;Mudar só esta transação&rdquo;.
              </span>
              <span className="block mt-1">
                <b className="font-medium text-slate-600 dark:text-slate-300">Não somar (entre minhas contas)</b>{' '}coloca
                a etiqueta &ldquo;Entre contas&rdquo; à mão; no mesmo lugar dá para voltar a somar.
              </span>
              <span className="block mt-1">
                <b className="font-medium text-slate-600 dark:text-slate-300">Mover para conta</b>{' '}passa o lançamento
                para outra conta, e <b className="font-medium text-slate-600 dark:text-slate-300">Excluir</b>{' '}apaga
                só este lançamento, depois de confirmar.
              </span>
            </Item>
            <Item icon={SquareCheck} iconClass="text-blue-600" title="Caixas de seleção.">
              Marque vários lançamentos (ou todos, pela caixa do título) para fazer de uma vez: mudar a categoria,
              marcar um evento, mover para outra conta ou excluir. Em &ldquo;Mais ações&rdquo; ainda dá para mudar o
              tipo, não somar, fixar e adicionar etiqueta. Antes de aplicar, o app mostra quantos serão alterados.
            </Item>
          </div>
        </div>
      )}
    </section>
  )
}
