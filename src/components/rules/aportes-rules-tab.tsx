'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Pencil, Trash2, ToggleLeft, ToggleRight, PiggyBank, Settings2, ArrowRight } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { BoardIcon } from '@/components/transactions/board-icon'
import { ContributionsSetup } from '@/components/investments/contributions-setup'
import { CategorizationRule, isInternalRule, matchesInternalRule } from '@/hooks/use-rules'
import { Transaction, TransactionBoard } from '@/types'
import { cn } from '@/lib/utils'

const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

type UpdateBoardFn = (id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) => Promise<{ error: string | null }>

/**
 * Aba Aportes: as regras "entre minhas contas" cujo destino é uma conta de
 * investimento, agrupadas por conta. Configurar usa o mesmo diálogo de
 * Investimentos → Aportes — a regra de aportes não muda aqui.
 */
export function AportesRulesTab({ boards, rules, transactions, createRule, updateRule, updateBoard, onDelete, onChanged }: {
  boards: TransactionBoard[]
  rules: CategorizationRule[]
  transactions: Transaction[]
  createRule: (keyword: string, category: string, extra?: Partial<CategorizationRule>) => Promise<CategorizationRule | undefined>
  updateRule: (id: string, data: Partial<CategorizationRule>) => Promise<{ ok: boolean; error?: string }>
  updateBoard: UpdateBoardFn
  onDelete: (rule: CategorizationRule) => void
  /** Depois de salvar: os lançamentos ligados mudaram, recarregar. */
  onChanged: () => void
}) {
  const [setupFor, setSetupFor] = useState<TransactionBoard | null>(null)
  const [notice, setNotice] = useState('')
  const investments = boards.filter(b => b.is_investment)
  const boardName = (id: string | null | undefined) => boards.find(b => b.id === id)?.name.trim() ?? 'Qualquer conta'

  const rows = useMemo(() => investments.map(board => {
    const boardRules = rules.filter(r => isInternalRule(r) && r.target_board_id === board.id)
    const aportes = transactions.filter(t => t.type === 'despesa' && t.counterpart_board_id === board.id)
    const byRule = new Map(boardRules.map(r => [r.id, aportes.filter(t => matchesInternalRule(t, r)).length]))
    const manual = aportes.filter(t => !boardRules.some(r => matchesInternalRule(t, r))).length
    return {
      board, boardRules, byRule, manual,
      count: aportes.length,
      total: aportes.reduce((s, t) => s + Number(t.amount), 0),
    }
  }), [investments, rules, transactions])

  if (investments.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 text-center">
        <PiggyBank className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto" />
        <p className="font-medium text-slate-600 dark:text-slate-300 mt-2">Nenhuma conta de investimento</p>
        <p className="text-sm text-slate-400 mt-1">Crie uma em Investimentos para configurar de onde saem os aportes.</p>
        <Link href="/investments" className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Abrir Investimentos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-5 pb-2">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Aportes por conta de investimento</h2>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">
          De qual conta e com qual texto sai o dinheiro de cada investimento. Aportes marcados à mão (⋮ → Aporte em…) também contam.
        </p>
        {notice && (
          <p className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">{notice}</p>
        )}

        <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60">
          {rows.map(({ board, boardRules, byRule, manual, count, total }) => (
            <div key={board.id} className="py-3">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${board.color}1f`, color: board.color }}>
                  <BoardIcon icon={board.icon} className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/transactions/${board.id}`} className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:underline truncate block">{board.name.trim()}</Link>
                  <p className="text-[11px] text-slate-400">
                    {boardRules.length} regra{boardRules.length === 1 ? '' : 's'} · {count} aporte{count === 1 ? '' : 's'}
                    {manual > 0 && <> · {manual} marcado{manual === 1 ? '' : 's'} à mão</>}
                  </p>
                </div>
                <span className="text-right shrink-0">
                  <span className="block text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{money(total)}</span>
                  <span className="block text-[10.5px] text-slate-400">total aportado</span>
                </span>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setSetupFor(board)}>
                  <Settings2 className="h-3.5 w-3.5" /> {boardRules.length ? 'Configurar' : 'Criar regra'}
                </Button>
              </div>

              {boardRules.length > 0 && (
                <div className="mt-2 ml-[30px] pl-3 border-l-2 border-slate-100 dark:border-white/[0.08]">
                  {boardRules.map(r => (
                    <div key={r.id} className={cn('flex items-center gap-3 rounded-lg px-2 py-1.5', !r.active && 'opacity-50')}>
                      <button type="button" onClick={() => updateRule(r.id, { active: !r.active })} className="shrink-0" title={r.active ? 'Desativar' : 'Ativar'}>
                        {r.active ? <ToggleRight className="h-5 w-5 text-blue-500" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                      </button>
                      <span className="text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded">{r.keyword}</span>
                      <span className="text-[11px] text-slate-400 truncate">saindo de {boardName(r.scope_board_id)}</span>
                      <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{byRule.get(r.id) ?? 0} lançamento{(byRule.get(r.id) ?? 0) === 1 ? '' : 's'}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0" aria-label="Ações da regra">
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setSetupFor(board)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateRule(r.id, { active: !r.active })}>
                            {r.active ? <><ToggleLeft className="h-4 w-4 mr-2" /> Desativar</> : <><ToggleRight className="h-4 w-4 mr-2" /> Ativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(r)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{investments.length} conta{investments.length === 1 ? '' : 's'} de investimento</span>
        <Link href="/investments" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Abrir Investimentos →</Link>
      </div>

      {setupFor && (
        <ContributionsSetup
          board={setupFor}
          boards={boards}
          rules={rules}
          createRule={createRule}
          updateRule={updateRule}
          updateBoard={updateBoard}
          onClose={() => setSetupFor(null)}
          onSaved={msg => { setNotice(msg); setSetupFor(null); onChanged() }}
        />
      )}
    </section>
  )
}
