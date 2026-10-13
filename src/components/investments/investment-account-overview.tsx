'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Transaction, TransactionBoard } from '@/types'
import { Kpi } from '@/components/ui/overview-blocks'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/components/investments/rico-position-summary'
import {
  AccountAssetsTable, AllocationCard, DailyEvolutionCard, EvolutionCard,
} from '@/components/investments/investments-overview'
import { useQuotes, type QuoteRange } from '@/hooks/use-quotes'
import { contributionsForBoard, investmentValueOf, investmentValueLabel } from '@/lib/investment-contributions'
import { computeConsolidatedPatrimonyVariation } from '@/lib/position-history'
import { isPositionStale, symbolsOf } from '@/lib/quotes'
import { cn } from '@/lib/utils'

type Linked = Pick<Transaction, 'id' | 'date' | 'amount' | 'type' | 'counterpart_board_id' | 'description' | 'board_id'>

const pctText = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%`
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${formatCurrency(Math.abs(v))}`
const ddmm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * Topo da tela de UMA conta de investimento: os quatro números, o aviso de
 * posição antiga, a evolução dia a dia, onde está o dinheiro e os ativos.
 * Mesma regra de valor de Investimentos: extrato OU aportes, nunca os dois;
 * ações/FIIs/cripto do extrato andam com o preço de hoje.
 */
export function InvestmentAccountOverview({ board, aportesIn, onUpdatePosition }: {
  board: TransactionBoard
  aportesIn: Linked[]
  onUpdatePosition: () => void
}) {
  const [range, setRange] = useState<QuoteRange>('1mo')
  const { quotes, history, loading } = useQuotes([board], range)
  const imp = board.last_position_import
  const iv = investmentValueOf(board, aportesIn, quotes)
  const base = investmentValueOf(board, aportesIn)
  const contrib = contributionsForBoard(board, aportesIn)
  const sym = symbolsOf([board])
  const quotable = sym.b3.length + sym.crypto.length > 0
  const variation = computeConsolidatedPatrimonyVariation([board])
  const valueClass = 'text-blue-600 dark:text-blue-400'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi
          title={iv.live ? 'Patrimônio hoje' : 'Patrimônio'}
          value={iv.source === 'none' ? '—' : formatCurrency(iv.value)}
          valueClass={valueClass}
          sub={iv.source === 'none' ? 'Importe a posição ou informe o valor' : investmentValueLabel(iv)}
        >
          {iv.live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-px text-[10px] font-semibold mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ao vivo{iv.live.at && ` · ${hhmm(iv.live.at)}`}
            </span>
          )}
        </Kpi>

        {iv.live && imp ? (
          <Kpi
            title={`Desde a posição (${ddmm(imp.importedAt)})`}
            value={signed(iv.live.delta)}
            valueClass={iv.live.delta >= 0 ? 'text-green-600' : 'text-red-500'}
            sub={`${imp.patrimonio > 0 ? `${pctText((iv.live.delta / imp.patrimonio) * 100)} · ` : ''}só o que o preço mexeu nos ativos`}
          />
        ) : variation?.canCompare && variation.delta != null ? (
          <Kpi
            title="Desde a atualização anterior"
            value={signed(variation.delta)}
            valueClass={variation.delta >= 0 ? 'text-green-600' : 'text-red-500'}
            sub={`${variation.deltaPercent != null ? `${pctText(variation.deltaPercent)} · ` : ''}${variation.previousLabel}: ${formatCurrency(variation.previous ?? 0)}`}
          />
        ) : (
          <Kpi title="Desde a atualização anterior" value="—" sub="Atualize mais uma vez para comparar" />
        )}

        <Kpi
          title="Total aportado"
          value={contrib.configured ? formatCurrency(contrib.aportado) : '—'}
          sub={contrib.configured
            ? `${contrib.base > 0 ? 'Ponto de partida + ' : ''}${contrib.aportes.length} aporte${contrib.aportes.length === 1 ? '' : 's'}`
            : 'Configure em Investimentos → Aportes'}
        />

        <Kpi
          title="Rendimento"
          value={iv.gain != null ? signed(iv.gain) : '—'}
          valueClass={iv.gain == null ? undefined : iv.gain >= 0 ? 'text-green-600' : 'text-red-500'}
          sub={iv.gain != null
            ? `${iv.aportado > 0 ? `${pctText((iv.gain / iv.aportado) * 100)} · ` : ''}valor de hoje − total aportado`
            : 'Precisa de extrato e de aportes'}
        />
      </div>

      {iv.live && imp && isPositionStale(imp.importedAt) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 min-w-0">
            Quantidades da posição de {new Date(imp.importedAt).toLocaleDateString('pt-BR')}. Comprou ou vendeu depois? Atualize a posição para o app saber a quantidade nova.
          </span>
          {imp.source !== 'manual' && (
            <Button size="sm" variant="outline" className="bg-white dark:bg-transparent" onClick={onUpdatePosition}>Atualizar posição</Button>
          )}
        </div>
      )}

      {imp && (
        <div className={cn('grid gap-4 items-start', 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
          {quotable ? (
            <DailyEvolutionCard
              title="Evolução desta conta"
              boards={[board]} baseTotal={base.value} history={history} quotes={quotes}
              range={range} onRange={setRange} loading={loading}
            />
          ) : (
            <EvolutionCard boards={[board]} />
          )}
          <AllocationCard boards={[board]} subtitle="Por classe de ativo · só esta conta" />
        </div>
      )}

      <AccountAssetsTable board={board} quotes={quotes} />
    </div>
  )
}
