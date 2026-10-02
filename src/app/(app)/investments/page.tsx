'use client'

import { withPlan } from '@/components/plan/with-plan'

import { useState, useMemo } from 'react'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { usePositionImport } from '@/hooks/use-position-import'
import { TransactionBoard, BoardType, BOARD_COLORS, BOARD_ICONS, BoardIconKey } from '@/types'
import { formatCurrency, rentColor } from '@/components/investments/rico-position-summary'
import { BoardIcon } from '@/components/transactions/board-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, PiggyBank, ChevronRight, AlertTriangle,
  ChevronDown, Upload, RefreshCw, AlertCircle, Pin, PinOff, CircleDollarSign, HandCoins, CheckCircle2, X,
} from 'lucide-react'
import { todayISO } from '@/utils/local-date'
import { useRules } from '@/hooks/use-rules'
import { useInvestmentContributions } from '@/hooks/use-investment-contributions'
import { contributionsForBoard, investmentValueOf, investmentValueLabel } from '@/lib/investment-contributions'
import { ContributionsSetup } from '@/components/investments/contributions-setup'
import { EmptyState } from '@/components/ui/empty-state'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTransactions } from '@/hooks/use-transactions'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useGoals } from '@/hooks/use-goals'
import { sumInvestmentContributions } from '@/lib/investment-contributions'
import { realMovements } from '@/lib/internal-movement'
import {
  InvestmentsSummary, AllocationCard, PositionsTable, EvolutionCard, ProventosCard, allocationOf,
} from '@/components/investments/investments-overview'
import { InvestmentsHelp } from '@/components/investments/investments-help'

interface AccountTemplate {
  id: string
  label: string
  description: string
  icon: BoardIconKey
  color: string
  type: BoardType
  suggestedName: string
}

// Todas do tipo "ambos" — o extrato de uma conta de investimento mistura
// rendimentos/vendas (entrada) com compras de ativos (saída) na mesma conta.
const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  { id: 'corretora',   label: 'Corretora',           description: 'RICO, XP, Clear, Nubank Investimentos...', icon: 'trending-up', color: '#22c55e', type: 'ambos', suggestedName: 'RICO' },
  { id: 'previdencia', label: 'Previdência Privada', description: 'PGBL, VGBL',                                icon: 'piggy-bank',   color: '#10b981', type: 'ambos', suggestedName: 'Previdência' },
  { id: 'cripto',      label: 'Criptomoedas',        description: 'Binance, Mercado Bitcoin...',               icon: 'coins',        color: '#f59e0b', type: 'ambos', suggestedName: 'Cripto' },
  { id: 'tesouro',     label: 'Tesouro Direto',      description: 'Títulos públicos',                          icon: 'dollar-sign',  color: '#3b82f6', type: 'ambos', suggestedName: 'Tesouro Direto' },
  { id: 'outro',       label: 'Outro',               description: 'Personalizado',                             icon: 'trending-up',  color: BOARD_COLORS[4], type: 'ambos', suggestedName: '' },
]

interface FormState {
  name: string
  color: string
  icon: string
  description: string
  type: BoardType
}

const EMPTY_FORM: FormState = {
  name: '',
  color: BOARD_COLORS[1],
  icon: 'trending-up',
  description: '',
  type: 'ambos',
}

function InvestmentsPage() {
  const router = useRouter()
  const now = new Date()
  const { boards: allBoards, loading, createBoard, updateBoard, deleteBoard } = useTransactionBoards()
  const boards = allBoards.filter(b => b.is_investment)

  const [formOpen, setFormOpen] = useState(false)
  const [formStep, setFormStep] = useState<'template' | 'form'>('template')
  const [editing, setEditing] = useState<TransactionBoard | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<TransactionBoard | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteTxCount, setDeleteTxCount] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')


  const {
    fileRef: positionFileRef, preview: positionPreview, loading: positionLoading, error: positionImportError,
    open: openPositionImport, handleFile: handlePositionFile, confirm: confirmPositionImport,
    cancel: cancelPositionImport, dismissError: dismissPositionError, saveManual,
  } = usePositionImport(updateBoard)

  // Aportes: o que saiu das suas contas para cada conta de investimento.
  const { rules, createRule, updateRule } = useRules()
  const { linked, reload: reloadLinked } = useInvestmentContributions(boards.map(b => b.id))
  const [setupFor, setSetupFor] = useState<TransactionBoard | null>(null)
  const [notice, setNotice] = useState('')
  const contributions = useMemo(
    () => new Map(boards.map(b => [b.id, contributionsForBoard(b, linked)])),
    [boards, linked],
  )
  // Rendimento só das contas com valor E aportes — misturar contas sem
  // aporte configurado daria um "rendimento" igual ao valor inteiro delas.
  // Valor de cada conta pela regra (investmentValueOf): extrato + aportes
  // depois dele, ou, sem extrato, a soma dos aportes.
  const values = useMemo(() => new Map(boards.map(b => [b.id, investmentValueOf(b, linked)])), [boards, linked])
  const gainBoards = boards.filter(b => values.get(b.id)?.gain != null)
  const totalInvested = gainBoards.reduce((s, b) => s + (values.get(b.id)?.aportado ?? 0), 0)
  const totalValue = gainBoards.reduce((s, b) => s + (values.get(b.id)?.value ?? 0), 0)

  // "Atualizar valor": para contas sem planilha (cripto, previdência, Tesouro,
  // outra corretora) — o valor informado vira a posição atual da conta.
  const [manualFor, setManualFor] = useState<TransactionBoard | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualError, setManualError] = useState('')
  const todayStr = todayISO()
  const parsedManual = parseFloat(manualValue.replace(/\./g, '').replace(',', '.'))
  const manualPrev = manualFor?.last_position_import ?? null
  const manualMinDate = manualPrev ? manualPrev.importedAt.slice(0, 10) : undefined

  function openManual(board: TransactionBoard) {
    setManualFor(board)
    setManualValue('')
    setManualDate(todayStr)
    setManualError('')
  }

  async function confirmManual() {
    if (!manualFor || !(parsedManual >= 0) || !manualDate) return
    const { error } = await saveManual(manualFor, parsedManual, manualDate)
    if (error) { setManualError(error); return }
    setManualFor(null)
  }

  // Fixar conta de investimento = entra SÓ nos totais dos Relatórios.
  // Dashboard e analytics excluem investimentos sempre, fixados ou não
  // (filtro `|| b.is_investment` nas duas páginas).
  function togglePinned(board: TransactionBoard) {
    updateBoard(board.id, { show_on_dashboard: !board.show_on_dashboard })
  }

  async function openDeleteConfirm(board: TransactionBoard) {
    setDeleteTarget(board)
    setDeleteStep(1)
    setDeleteError('')
    setDeleteTxCount(null)
    const supabase = createClient()
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', board.id)
    setDeleteTxCount(count ?? 0)
  }

  async function confirmDeleteFinal() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const { error } = await deleteBoard(deleteTarget.id)
    setDeleting(false)
    if (error) { setDeleteError(error); return }
    setDeleteTarget(null)
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormStep('template')
    setFormOpen(true)
  }

  function selectTemplate(tpl: AccountTemplate) {
    setForm({
      name: tpl.suggestedName,
      color: tpl.color,
      icon: tpl.icon,
      description: '',
      type: tpl.type,
    })
    setFormStep('form')
  }

  function openEdit(board: TransactionBoard) {
    setEditing(board)
    setForm({ name: board.name, color: board.color, icon: board.icon, description: board.description ?? '', type: board.type })
    setFormStep('form')
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name: form.name,
      color: form.color,
      icon: form.icon as TransactionBoard['icon'],
      description: form.description || undefined,
      type: form.type,
      is_investment: true,
      opening_balance: 0,
      show_on_dashboard: editing?.show_on_dashboard ?? false,
    }
    if (editing) {
      updateBoard(editing.id, data)
    } else {
      await createBoard(data)
    }
    setFormOpen(false)
  }

  // Aportes do mês e meta de investir: mesmas regras do Dashboard.
  const unpinnedBoardIds = useMemo(
    () => allBoards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [allBoards],
  )
  const { transactions: monthTxs } = useTransactions({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    exclude_board_ids: unpinnedBoardIds.length > 0 ? unpinnedBoardIds : undefined,
  })
  const monthlyContributions = useMemo(() => sumInvestmentContributions(monthTxs, allBoards), [monthTxs, allBoards])
  const monthIncome = useMemo(
    () => realMovements(monthTxs).filter(t => t.type === 'receita').reduce((sum, t) => sum + Number(t.amount), 0),
    [monthTxs],
  )
  const { plan } = useBudgetPlan(now.getMonth() + 1, now.getFullYear())
  const investTarget = plan?.investment_target ?? 0
  // Meta que puxa o valor de uma destas contas (Metas → "Vincular conta").
  const { goals } = useGoals()
  const linkedGoal = goals.find(g => g.lastImport?.source === 'board' && boards.some(b => b.id === g.lastImport?.boardId)) ?? null
  const hasPositions = boards.some(b => (b.last_position_import?.positions?.length ?? 0) > 0)

  if (loading) return null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Investimentos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {boards.length === 0 ? 'Adicione sua primeira conta de investimento' : 'Sua carteira, seus aportes e suas metas num lugar só'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Com uma conta só, importa direto nela; com várias, pergunta qual. */}
          {boards.length === 1 && (
            <Button variant="outline" className="gap-2" disabled={positionLoading} onClick={() => openPositionImport(boards[0])}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Importar posição</span>
            </Button>
          )}
          {boards.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.08] disabled:opacity-50" disabled={positionLoading}>
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importar posição</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {boards.map(b => (
                  <DropdownMenuItem key={b.id} onClick={() => openPositionImport(b)}>
                    <BoardIcon icon={b.icon} className="h-4 w-4 mr-2" style={{ color: b.color }} />
                    {b.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        </div>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Adicione sua primeira conta de investimento"
          description="Organize corretoras, previdência, cripto e tesouro direto separado das suas contas do dia a dia. Depois, entre na conta pra importar o extrato e a posição da carteira."
          primaryLabel="Adicionar conta"
          primaryOnClick={openCreate}
          secondaryLabel="Saiba mais"
          secondaryHref="/help"
        />
      ) : (
        <div className="space-y-6">
          <InvestmentsSummary
            boards={boards}
            contributions={monthlyContributions}
            target={investTarget}
            income={monthIncome}
            goal={linkedGoal}
          />

          {notice && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice('')} className="text-emerald-500 hover:text-emerald-700"><X className="h-4 w-4" /></button>
            </div>
          )}

          {gainBoards.length > 0 && totalInvested > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-white/[0.06] bg-white dark:bg-[#111c2d] shadow-sm p-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total aportado</p>
                <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(totalInvested)}</p>
                <p className="text-[11px] text-slate-400">{gainBoards.map(b => b.name.trim()).join(', ')}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Valor atual</p>
                <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(totalValue)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Rendimento</p>
                <p className={`text-xl font-bold tabular-nums ${totalValue - totalInvested >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {totalValue - totalInvested >= 0 ? '+' : '−'}{formatCurrency(Math.abs(totalValue - totalInvested))}
                  <span className="text-sm font-semibold"> ({totalValue - totalInvested >= 0 ? '+' : ''}{(((totalValue - totalInvested) / totalInvested) * 100).toFixed(1).replace('.', ',')}%)</span>
                </p>
                <p className="text-[11px] text-slate-400">valor atual − total aportado</p>
              </div>
            </div>
          )}

          {hasPositions && (
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
              <AllocationCard boards={boards} />
              <PositionsTable boards={boards} />
            </div>
          )}

          {hasPositions && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
              <EvolutionCard boards={boards} />
              <ProventosCard boards={boards} />
            </div>
          )}

          {/* Contas de investimento — mesmo padrão de Contas e Cartões: o card
              inteiro abre a conta, os botões do canto não. */}
          <section>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Suas contas de investimento</h2>
              <span className="text-xs text-slate-400">{boards.length}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map(board => {
                const imp = board.last_position_import
                const open = () => router.push(`/transactions/${board.id}`)
                const alloc = imp ? allocationOf([board]) : []
                const allocTotal = alloc.reduce((sum, a) => sum + a.value, 0)
                return (
                  <div
                    key={board.id}
                    role="link"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={e => { if (e.key === 'Enter') open() }}
                    className="group cursor-pointer bg-white dark:bg-[#111c2d] rounded-xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden transition-all hover:-translate-y-px hover:shadow-md hover:border-slate-300 dark:hover:border-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <div className="h-1 w-full" style={{ backgroundColor: board.color }} />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: board.color + '20' }}>
                          <BoardIcon icon={board.icon} className="h-4 w-4" style={{ color: board.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={board.name}>{board.name}</p>
                          {board.description && <p className="text-[11px] text-slate-400 truncate">{board.description}</p>}
                        </div>
                        <div className="flex -mr-1.5 -mt-1.5 shrink-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                          <button
                            title={board.show_on_dashboard ? 'Remover dos relatórios' : 'Incluir nos relatórios'}
                            onClick={() => togglePinned(board)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            {board.show_on_dashboard ? <Pin className="h-3.5 w-3.5 text-blue-500" /> : <PinOff className="h-3.5 w-3.5 text-slate-400" />}
                          </button>
                          <button
                            title="Aportes: de onde sai o dinheiro desta conta"
                            onClick={() => setSetupFor(board)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <HandCoins className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          <button
                            title="Atualizar valor (informar à mão)"
                            disabled={positionLoading}
                            onClick={() => openManual(board)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            <CircleDollarSign className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          <button
                            title={imp ? 'Atualizar posição (planilha da corretora)' : 'Importar posição (planilha da corretora)'}
                            disabled={positionLoading}
                            onClick={() => openPositionImport(board)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                          >
                            {positionLoading ? <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-slate-400" />}
                          </button>
                          <button title="Editar" onClick={() => openEdit(board)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                          <button title="Excluir" onClick={() => openDeleteConfirm(board)} className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                          </button>
                        </div>
                      </div>

                      {(imp || values.get(board.id)?.source === 'aportes') ? (
                        <>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-3">Patrimônio</p>
                          <p className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatCurrency(values.get(board.id)?.value ?? 0)}</p>
                          <p className="text-[11px] text-slate-400">{investmentValueLabel(values.get(board.id)!, formatCurrency)}</p>
                          {allocTotal > 0 && (
                            <div className="flex h-1.5 rounded-full overflow-hidden mt-2 bg-slate-100 dark:bg-white/[0.08]">
                              {alloc.map(a => <div key={a.name} title={a.name} style={{ width: `${(a.value / allocTotal) * 100}%`, backgroundColor: a.color }} />)}
                            </div>
                          )}
                          {imp && imp.source !== 'manual' && (
                            <p className="text-[11px] text-slate-400 mt-1.5">{imp.positions.length} ativo{imp.positions.length === 1 ? '' : 's'} no extrato</p>
                          )}
                          {(() => {
                            const c = contributions.get(board.id)
                            if (!c?.configured) {
                              return (
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setSetupFor(board) }}
                                  className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Configurar aportes para ver o rendimento →
                                </button>
                              )
                            }
                            const iv = values.get(board.id)!
                            if (iv.gain == null) {
                              return (
                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-[11px]" onClick={e => e.stopPropagation()}>
                                  <p className="text-slate-400">Aportado <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{formatCurrency(c.aportado)}</span></p>
                                  <p className="text-slate-400 mt-0.5">
                                    Rendimento aparece com um extrato ·{' '}
                                    <button type="button" onClick={() => openManual(board)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">informar valor</button>
                                    {' '}ou{' '}
                                    <button type="button" onClick={() => openPositionImport(board)} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">importar planilha</button>
                                  </p>
                                </div>
                              )
                            }
                            const gain = iv.gain
                            return (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <p className="text-slate-400">Aportado</p>
                                  <p className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(c.aportado)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Rendimento</p>
                                  <p className={`font-semibold tabular-nums ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain))}
                                    {c.aportado > 0 && <> ({gain >= 0 ? '+' : ''}{((gain / c.aportado) * 100).toFixed(1).replace('.', ',')}%)</>}
                                  </p>
                                </div>
                              </div>
                            )
                          })()}
                        </>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 dark:border-white/[0.1] p-3 text-center" onClick={e => e.stopPropagation()}>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Sem valor ainda — esta conta não entra no seu patrimônio.</p>
                          <div className="mt-1.5 flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => openManual(board)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <CircleDollarSign className="h-3.5 w-3.5" /> Informar valor
                            </button>
                            <button
                              type="button"
                              onClick={() => openPositionImport(board)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                            >
                              <Upload className="h-3.5 w-3.5" /> Importar planilha
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <InvestmentsHelp />
        </div>
      )}

      {/* MODAL — template + form */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar conta' : formStep === 'template' ? 'Que tipo de investimento?' : 'Nova conta'}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — template picker */}
          {!editing && formStep === 'template' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              {ACCOUNT_TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => selectTemplate(tpl)}
                  className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 dark:border-white/[0.07] hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all text-left group"
                >
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: tpl.color + '20' }}
                  >
                    <BoardIcon icon={tpl.icon} className="h-4.5 w-4.5" style={{ color: tpl.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{tpl.label}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 truncate">{tpl.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors ml-auto shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — form */}
          {(editing || formStep === 'form') && (
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              {!editing && (
                <button
                  type="button"
                  onClick={() => setFormStep('template')}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 -mt-1"
                >
                  ← Mudar tipo
                </button>
              )}

              <div className="space-y-2">
                <Label htmlFor="board-name">Nome da conta</Label>
                <Input
                  id="board-name"
                  placeholder="Ex: RICO, XP, Nubank Investimentos..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="board-desc">Descrição (opcional)</Label>
                <Input
                  id="board-desc"
                  placeholder="Ex: Carteira de ações e FIIs"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="grid grid-cols-6 gap-2 pt-1">
                  {BOARD_ICONS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      title={label}
                      onClick={() => setForm(f => ({ ...f, icon: key }))}
                      className={`h-9 w-9 rounded-lg flex items-center justify-center border-2 transition-all ${
                        form.icon === key
                          ? 'border-slate-800 dark:border-slate-200 bg-slate-100 dark:bg-slate-700'
                          : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <BoardIcon icon={key as BoardIconKey} className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {BOARD_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color }))}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: form.color === color ? '#1e293b' : 'transparent',
                        outline: form.color === color ? '2px solid white' : 'none',
                        outlineOffset: '-3px',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
                <Button type="submit" className="flex-1">{editing ? 'Salvar' : 'Criar conta'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM — duas etapas, porque isso apaga transações de verdade */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          {deleteStep === 1 ? (
            <>
              <DialogHeader><DialogTitle>Excluir conta</DialogTitle></DialogHeader>
              <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
                Excluir <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>?
              </p>
              <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3.5 mt-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {deleteTxCount === null
                    ? 'Contando lançamentos vinculados...'
                    : <>Isso vai apagar <strong>permanentemente {deleteTxCount} lançamento{deleteTxCount !== 1 ? 's' : ''}</strong> vinculado{deleteTxCount !== 1 ? 's' : ''} a essa conta, junto com a conta em si. Não pode ser desfeito.</>
                  }
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteStep(2)}
                  disabled={deleteTxCount === null}
                  className="flex-1"
                >
                  Continuar
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>Tem certeza mesmo?</DialogTitle></DialogHeader>
              <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
                Última confirmação: você está prestes a excluir <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> e apagar definitivamente {deleteTxCount} lançamento{deleteTxCount !== 1 ? 's' : ''}. Essa ação é <strong>irreversível</strong>.
              </p>
              {deleteError && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mt-2">
                  {deleteError}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteStep(1)} disabled={deleting} className="flex-1">Voltar</Button>
                <Button variant="destructive" onClick={confirmDeleteFinal} disabled={deleting} className="flex-1">
                  {deleting ? 'Excluindo...' : 'Sim, excluir tudo'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {setupFor && (
        <ContributionsSetup
          board={setupFor}
          boards={allBoards}
          rules={rules}
          createRule={createRule}
          updateRule={updateRule}
          updateBoard={updateBoard}
          onClose={() => setSetupFor(null)}
          onSaved={msg => { setSetupFor(null); setNotice(msg); reloadLinked() }}
        />
      )}

      {/* Atualizar valor à mão */}
      <Dialog open={!!manualFor} onOpenChange={v => { if (!v) setManualFor(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Atualizar valor — {manualFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informe quanto vale esta conta hoje, como aparece no app do banco ou da corretora. O valor entra no seu patrimônio, na evolução e nas metas ligadas a esta conta.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="manual-value" className="text-xs">Valor atual (R$)</Label>
                <Input id="manual-value" inputMode="decimal" placeholder="0,00" value={manualValue} onChange={e => setManualValue(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-date" className="text-xs">Valor de</Label>
                <Input id="manual-date" type="date" value={manualDate} min={manualMinDate} max={todayStr} onChange={e => setManualDate(e.target.value)} />
              </div>
            </div>
            {manualPrev && parsedManual >= 0 && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                {formatCurrency(manualPrev.patrimonio)} ({new Date(manualPrev.importedAt).toLocaleDateString('pt-BR')}) → <strong>{formatCurrency(parsedManual)}</strong>
                <span className={parsedManual - manualPrev.patrimonio >= 0 ? 'text-green-600' : 'text-red-500'}>
                  {' '}({parsedManual - manualPrev.patrimonio >= 0 ? '+' : '−'}{formatCurrency(Math.abs(parsedManual - manualPrev.patrimonio))})
                </span>
              </div>
            )}
            {(manualPrev?.positions?.length ?? 0) > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                Esta conta tem a lista de ativos da última planilha. Com um valor informado, a divisão por ativo deixa de aparecer — para tê-la de volta, use &ldquo;Importar posição&rdquo; com a planilha nova.
              </p>
            )}
            {manualError && <p className="text-xs text-red-500">{manualError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setManualFor(null)} className="flex-1">Cancelar</Button>
              <Button onClick={confirmManual} disabled={!(parsedManual >= 0) || !manualDate || positionLoading} className="flex-1">
                {positionLoading ? 'Salvando...' : 'Salvar valor'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Input escondido + preview pra importar posição da carteira */}
      <input ref={positionFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handlePositionFile} />

      <Dialog open={!!positionPreview || !!positionImportError} onOpenChange={v => { if (!v) { cancelPositionImport(); dismissPositionError() } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirmar importação da posição</DialogTitle></DialogHeader>
          {positionImportError && !positionPreview && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{positionImportError}
              </p>
              <Button variant="outline" onClick={dismissPositionError} className="w-full">Fechar</Button>
            </div>
          )}
          {positionPreview && (
            <div className="space-y-4 pt-1">
              <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Total investido em ativos</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(positionPreview.totalInvestido)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Saldo disponível</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(positionPreview.saldoDisponivel)}</span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Patrimônio total</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(positionPreview.patrimonio)}</span>
                </div>
              </div>
              {positionPreview.positions.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{positionPreview.positions.length} posições</p>
                  {positionPreview.positions.map(p => (
                    <div key={p.ticker} className="flex justify-between text-xs">
                      <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{p.ticker}</span>
                      <span className={rentColor(p.rentabilidade)}>{p.rentabilidade}</span>
                      <span className="text-slate-600 dark:text-slate-300">{formatCurrency(p.value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={cancelPositionImport} className="flex-1">Cancelar</Button>
                <Button onClick={confirmPositionImport} className="flex-1">Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withPlan(
  'investments',
  InvestmentsPage,
  'Acompanhe a carteira, a alocação por classe e os proventos recebidos junto com o resto do seu dinheiro.',
)
