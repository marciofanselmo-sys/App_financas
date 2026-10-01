'use client'

import { usePlan } from '@/hooks/use-subscription'
import { PLANS, planoComMais } from '@/lib/plans'
import { UpgradeCard } from '@/components/plan/plan-gate'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useTransactions } from '@/hooks/use-transactions'
import { TransactionBoard, Transaction, BoardType, BoardKind, BOARD_COLORS, BOARD_ICONS, BoardIconKey } from '@/types'
import { BOARD_KINDS, boardKind } from '@/lib/board-kind'
import { BoardIcon } from '@/components/transactions/board-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Wallet, Pin, PinOff, ArrowRight, ChevronRight, AlertTriangle, CreditCard, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import { balanceFromTransactions, formatDashboardCurrency, upToToday, looksLikeMissingCardData } from '@/lib/dashboard-patrimony'

// `monthTxs` é o recorte do mês (usado só na contagem de lançamentos) e
// `allTxs` é o histórico completo — de onde sai o saldo. São dois conjuntos
// diferentes de propósito: o saldo da conta não pode mudar quando vira o mês.
function computeStats(
  monthTxs: Transaction[],
  allTxs: Transaction[],
  board: TransactionBoard,
) {
  return {
    count: monthTxs.filter(t => t.board_id === board.id).length,
    // Até hoje, não o histórico inteiro: parcela futura é compromisso, não
    // dinheiro que já saiu da conta.
    balance: Number(board.opening_balance ?? 0)
      + balanceFromTransactions(upToToday(allTxs.filter(t => t.board_id === board.id))),
  }
}

interface AccountTemplate {
  id: string
  label: string
  description: string
  icon: BoardIconKey
  color: string
  type: BoardType
  kind: BoardKind
  suggestedName: string
}

const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  { id: 'conta-corrente',   label: 'Conta Corrente',   description: 'Bradesco, Itaú, Nubank...', icon: 'building',      color: '#3b82f6', type: 'ambos',  kind: 'corrente', suggestedName: 'Conta Corrente'   },
  { id: 'cartao-credito',   label: 'Cartão de Crédito', description: 'Crédito e compras parceladas', icon: 'credit-card',  color: '#8b5cf6', type: 'saida',  kind: 'credito', suggestedName: 'Cartão de Crédito' },
  { id: 'carteira-digital', label: 'Carteira Digital',  description: 'PicPay, Mercado Pago, PayPal', icon: 'wallet',       color: '#06b6d4', type: 'ambos',  kind: 'digital', suggestedName: 'Carteira Digital'  },
  { id: 'poupanca',         label: 'Poupança',          description: 'Reserva de emergência', icon: 'piggy-bank',    color: '#10b981', type: 'ambos',  kind: 'poupanca', suggestedName: 'Poupança'          },
  { id: 'dinheiro-fisico',  label: 'Dinheiro Físico',   description: 'Espécie e carteira', icon: 'coins',         color: '#f59e0b', type: 'ambos',  kind: 'dinheiro', suggestedName: 'Dinheiro Físico'   },
  { id: 'outro',            label: 'Outro',             description: 'Personalizado', icon: 'wallet',       color: BOARD_COLORS[2], type: 'ambos', kind: 'outro', suggestedName: '' },
]

const BOARD_TYPE_OPTIONS: { value: BoardType; label: string; desc: string }[] = [
  { value: 'entrada', label: 'Entrada',  desc: 'Receitas e depósitos' },
  { value: 'saida',   label: 'Saída',    desc: 'Despesas e gastos' },
  { value: 'ambos',   label: 'Ambos',    desc: 'Entradas e saídas' },
]

interface FormState {
  name: string
  color: string
  icon: string
  description: string
  type: BoardType
  kind: BoardKind
  // Texto, não número: o campo aceita vírgula e pode estar vazio enquanto o
  // usuário digita. Vira número só na hora de salvar.
  openingBalance: string
}

const EMPTY_FORM: FormState = {
  name: '',
  color: BOARD_COLORS[1],
  icon: 'wallet',
  description: '',
  type: 'ambos',
  kind: 'outro',
  openingBalance: '',
}

export default function TransactionsPage() {
  const router = useRouter()
  const now = new Date()
  const { boards: allBoards, loading, createBoard, updateBoard, deleteBoard } = useTransactionBoards()
  const { plan, tier } = usePlan()
  const boards = allBoards.filter(b => !b.is_investment)
  const { transactions } = useTransactions({ month: now.getMonth() + 1, year: now.getFullYear() })
  // Histórico completo, sem filtro de período: é daqui que sai o saldo de cada
  // card, o mesmo número que o Patrimônio mostra no dashboard.
  const { transactions: allTransactions } = useTransactions()

  const [formOpen, setFormOpen] = useState(false)
  const [boardLimitOpen, setBoardLimitOpen] = useState(false)
  const [formStep, setFormStep] = useState<'template' | 'form'>('template')
  const [editing, setEditing] = useState<TransactionBoard | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<TransactionBoard | null>(null)
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteTxCount, setDeleteTxCount] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
    // Limite do plano: avisa ANTES de abrir o formulário, para ninguém
    // preencher a conta inteira e só então descobrir que não pode criar.
    if (plan.maxBoards !== null && allBoards.length >= plan.maxBoards) {
      setBoardLimitOpen(true)
      return
    }
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
      kind: tpl.kind,
      openingBalance: '',
    })
    setFormStep('form')
  }

  function openEdit(board: TransactionBoard) {
    setEditing(board)
    setForm({
      name: board.name, color: board.color, icon: board.icon,
      description: board.description ?? '', type: board.type, kind: boardKind(board),
      openingBalance: board.opening_balance ? String(board.opening_balance).replace('.', ',') : '',
    })
    setFormStep('form')
    setFormOpen(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name: form.name,
      color: form.color,
      icon: form.icon as TransactionBoard['icon'],
      description: form.description || undefined,
      type: form.type,
      kind: form.kind,
      is_investment: false,
      show_on_dashboard: editing?.show_on_dashboard ?? false,
      opening_balance: parseFloat(form.openingBalance.replace(/\./g, '').replace(',', '.')) || 0,
    }
    if (editing) updateBoard(editing.id, data)
    else createBoard(data)
    setFormOpen(false)
  }

  function toggleDashboard(board: TransactionBoard) {
    updateBoard(board.id, { show_on_dashboard: !board.show_on_dashboard })
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Contas e Cartões</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {boards.length === 0 ? 'Adicione sua primeira conta ou cartão' : `${boards.length} conta${boards.length > 1 ? 's' : ''} cadastrada${boards.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova conta
        </Button>
      </div>

      {boards.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Adicione sua primeira conta ou cartão"
          description="Organize seus lançamentos por conta bancária, cartão de crédito ou carteira digital e acompanhe cada uma separado."
          primaryLabel="Adicionar conta"
          primaryOnClick={openCreate}
          secondaryLabel="Saiba mais"
          secondaryHref="/help"
        />
      ) : (
        // Agrupada pelo tipo da conta; grupo vazio não aparece. O card
        // inteiro abre os lançamentos — os botões do canto não.
        <div className="space-y-8">
          {BOARD_KINDS.map(kind => {
            const list = boards.filter(b => boardKind(b) === kind.key)
            if (list.length === 0) return null
            const withStats = list.map(board => ({ board, stats: computeStats(transactions, allTransactions, board) }))
            const total = withStats.reduce((sum, { stats }) => sum + stats.balance, 0)
            return (
              <section key={kind.key}>
                <div className="flex items-end justify-between gap-3 mb-3 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{kind.group}</h2>
                    <span className="text-xs text-slate-400">{list.length}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {kind.key === 'credito' ? 'Faturas somadas' : 'Saldo somado'}:{' '}
                    <strong className={cn('tabular-nums', total < 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200')}>
                      {formatDashboardCurrency(total)}
                    </strong>
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {withStats.map(({ board, stats }) => {
                    const open = () => router.push(`/transactions/${board.id}`)
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
                              <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                board.type === 'entrada'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : board.type === 'saida'
                                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                              }`}>
                                {board.type === 'entrada' ? 'Entrada' : board.type === 'saida' ? 'Saída' : 'Ambos'}
                              </span>
                            </div>
                            {/* Os botões param o clique aqui, para não abrir a conta junto. */}
                            <div className="flex -mr-1.5 -mt-1.5 shrink-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                              <button
                                title={board.show_on_dashboard ? 'Remover do dashboard' : 'Fixar no dashboard'}
                                onClick={() => toggleDashboard(board)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                {board.show_on_dashboard
                                  ? <Pin className="h-3.5 w-3.5 text-blue-500" />
                                  : <PinOff className="h-3.5 w-3.5 text-slate-400" />}
                              </button>
                              <button
                                title="Editar"
                                onClick={() => openEdit(board)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-slate-400" />
                              </button>
                              <button
                                title="Excluir"
                                onClick={() => openDeleteConfirm(board)}
                                className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {kind.key === 'credito' ? 'Fatura / saldo' : 'Saldo da conta'}
                              </p>
                              <p className={`text-lg font-bold tabular-nums ${stats.balance >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-500'}`}>
                                {formatDashboardCurrency(stats.balance)}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {stats.count} lançamento{stats.count !== 1 ? 's' : ''} este mês
                              </p>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 shrink-0"
                              style={{ color: board.color }}
                            >
                              Ver lançamentos <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                          {(kind.key === 'credito' ? stats.balance > 0.005 : looksLikeMissingCardData(board, stats.balance)) && (
                            <p className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                              Saldo positivo num cartão costuma indicar compras faltando — confira se alguma fatura ficou sem importar.
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Legenda: o que cada botão do card faz e como o saldo é calculado. */}
      {boards.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Como funcionam os cards</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Os botões do canto</p>
              <div className="flex gap-3">
                <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <Pin className="h-3.5 w-3.5 text-blue-500" />
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Fixar no dashboard.</strong> Com o alfinete
                  azul, a conta entra nas somas do app: saldo e patrimônio do Dashboard, Análise, Relatórios e parcelas.
                  Com o alfinete cinza, a conta continua aqui com todos os lançamentos, mas fica fora dessas somas —
                  útil para uma conta da empresa, conjunta ou que você só quer guardar o histórico.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <Pencil className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Editar.</strong> Troca o nome, o tipo da conta
                  (o grupo em que ela aparece nesta tela), se ela recebe entradas, saídas ou os dois, o ícone, a cor e o
                  saldo antes de começar. Nenhum lançamento é alterado.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <Trash2 className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Excluir.</strong> Apaga a conta e todos os
                  lançamentos dela, de todos os meses. Antes, o app mostra quantos lançamentos serão apagados e pede
                  confirmação duas vezes — não dá para desfazer. Se a ideia é só tirar a conta das somas, use o alfinete.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">O valor do card</p>
              <div className="flex gap-3">
                <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <Wallet className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Saldo da conta.</strong> É o saldo antes de
                  começar, mais tudo o que entrou, menos tudo o que saiu, até hoje. Lançamentos com data futura, como
                  parcelas que ainda vão vencer, só contam quando chega o dia deles.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="h-7 w-7 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center shrink-0">
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="text-slate-700 dark:text-slate-200">Cartão de crédito fica negativo — e isso é o
                  normal.</strong> O valor do cartão é o quanto você está devendo. Cada compra deixa o número mais
                  negativo, porque é um dinheiro que você só vai pagar depois, na fatura. Quando a fatura é paga, o
                  pagamento entra no cartão e o valor volta para perto de zero. No topo do grupo, &ldquo;Faturas
                  somadas&rdquo; mostra o total que você deve em todos os cartões. Se um cartão aparecer positivo,
                  quase sempre falta importar alguma fatura — o card avisa quando isso acontece.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* MODAL — template + form */}
      {/* Limite de contas do plano */}
      <Dialog open={boardLimitOpen} onOpenChange={v => { if (!v) setBoardLimitOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Limite de contas do seu plano</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <UpgradeCard
              feature="import"
              tier={planoComMais(tier, 'maxBoards')}
              title={`Mais contas no plano ${PLANS[planoComMais(tier, 'maxBoards')].label}`}
              pitch={`Seu plano permite ${plan.maxBoards} conta${plan.maxBoards === 1 ? '' : 's'}, e você já usou todas. Nenhuma conta sua é apagada — para cadastrar mais uma, é só liberar um plano maior.`}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar conta' : formStep === 'template' ? 'Que tipo de conta?' : 'Nova conta'}
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
                  placeholder="Ex: Nubank, Bradesco, Cartão Visa..."
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
                  placeholder="Ex: Gastos do dia a dia"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Ninguém começa a usar o app no dia em que abriu a conta: o
                  cartão já tem fatura, a conta já tem saldo. Sem isso o app
                  assume zero e o patrimônio nasce errado — e não se corrige
                  sozinho, porque é histórico que nunca vai ser importado. */}
              <div className="space-y-2">
                <Label htmlFor="board-opening">Saldo antes de começar (opcional)</Label>
                <Input
                  id="board-opening"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.openingBalance}
                  onChange={e => setForm(f => ({ ...f, openingBalance: e.target.value }))}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quanto esta conta tinha antes do primeiro lançamento que você
                  vai importar. Em cartão de crédito, use <strong>negativo</strong>
                  {' '}para a fatura em aberto (ex: <code>-1200,00</code>). Deixe
                  vazio se o histórico começa do zero.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de conta</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BOARD_KINDS.map(k => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, kind: k.key }))}
                      className={cn(
                        'rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-all',
                        form.kind === k.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500',
                      )}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Define em qual grupo a conta aparece.</p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de lançamento</Label>
                <div className="grid grid-cols-3 gap-2">
                  {BOARD_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                        form.type === opt.value
                          ? opt.value === 'entrada'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : opt.value === 'saida'
                            ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                            : 'border-slate-500 bg-slate-100 dark:bg-slate-700'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${
                        form.type === opt.value
                          ? opt.value === 'entrada' ? 'text-green-700 dark:text-green-400'
                          : opt.value === 'saida' ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-700 dark:text-slate-200'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}>{opt.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
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
    </div>
  )
}
