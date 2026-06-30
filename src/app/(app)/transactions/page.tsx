'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useTransactions } from '@/hooks/use-transactions'
import { TransactionBoard, Transaction, BoardType, BOARD_COLORS, BOARD_ICONS, BoardIconKey } from '@/types'
import { BoardIcon } from '@/components/transactions/board-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Wallet, Pin, PinOff, ArrowRight, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function computeStats(transactions: Transaction[], boardId: string) {
  const txs = transactions.filter(t => t.board_id === boardId)
  const income = txs.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  return { income, expenses, balance: income - expenses, count: txs.length }
}

interface AccountTemplate {
  id: string
  label: string
  description: string
  icon: BoardIconKey
  color: string
  type: BoardType
  suggestedName: string
}

const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  { id: 'conta-corrente',   label: 'Conta Corrente',   description: 'Bradesco, Itaú, Nubank...', icon: 'building',      color: '#3b82f6', type: 'ambos',  suggestedName: 'Conta Corrente'   },
  { id: 'cartao-credito',   label: 'Cartão de Crédito', description: 'Crédito e compras parceladas', icon: 'credit-card',  color: '#8b5cf6', type: 'saida',  suggestedName: 'Cartão de Crédito' },
  { id: 'carteira-digital', label: 'Carteira Digital',  description: 'PicPay, Mercado Pago, PayPal', icon: 'wallet',       color: '#06b6d4', type: 'ambos',  suggestedName: 'Carteira Digital'  },
  { id: 'poupanca',         label: 'Poupança',          description: 'Reserva de emergência', icon: 'piggy-bank',    color: '#10b981', type: 'ambos',  suggestedName: 'Poupança'          },
  { id: 'investimentos',    label: 'Investimentos',     description: 'CDB, ações, fundos', icon: 'trending-up',   color: '#22c55e', type: 'ambos',  suggestedName: 'Investimentos'     },
  { id: 'dinheiro-fisico',  label: 'Dinheiro Físico',   description: 'Espécie e carteira', icon: 'coins',         color: '#f59e0b', type: 'ambos',  suggestedName: 'Dinheiro Físico'   },
  { id: 'outro',            label: 'Outro',             description: 'Personalizado', icon: 'wallet',       color: BOARD_COLORS[2], type: 'ambos', suggestedName: '' },
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
}

const EMPTY_FORM: FormState = {
  name: '',
  color: BOARD_COLORS[1],
  icon: 'wallet',
  description: '',
  type: 'ambos',
}

export default function TransactionsPage() {
  const router = useRouter()
  const now = new Date()
  const { boards, loading, createBoard, updateBoard, deleteBoard } = useTransactionBoards()
  const { transactions } = useTransactions({ month: now.getMonth() + 1, year: now.getFullYear() })

  const [formOpen, setFormOpen] = useState(false)
  const [formStep, setFormStep] = useState<'template' | 'form'>('template')
  const [editing, setEditing] = useState<TransactionBoard | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<TransactionBoard | null>(null)

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      name: form.name,
      color: form.color,
      icon: form.icon as TransactionBoard['icon'],
      description: form.description || undefined,
      type: form.type,
      show_on_dashboard: editing?.show_on_dashboard ?? false,
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Contas e Cartões</h1>
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
        <div className="space-y-4">
          {boards.map(board => {
            const stats = computeStats(transactions, board.id)
            const balancePositive = stats.balance >= 0

            return (
              <div
                key={board.id}
                className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden"
              >
                <div className="h-1 w-full" style={{ backgroundColor: board.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: board.color + '20' }}>
                        <BoardIcon icon={board.icon} className="h-5 w-5" style={{ color: board.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{board.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            board.type === 'entrada'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : board.type === 'saida'
                              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}>
                            {board.type === 'entrada' ? 'Entrada' : board.type === 'saida' ? 'Saída' : 'Ambos'}
                          </span>
                        </div>
                        {board.description && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{board.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        title={board.show_on_dashboard ? 'Remover do dashboard' : 'Fixar no dashboard'}
                        onClick={() => toggleDashboard(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {board.show_on_dashboard
                          ? <Pin className="h-3.5 w-3.5 text-blue-500" />
                          : <PinOff className="h-3.5 w-3.5 text-slate-400" />
                        }
                      </button>
                      <button
                        onClick={() => openEdit(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Entradas</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(stats.income)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Saídas</p>
                      <p className="text-sm font-semibold text-red-500">{formatCurrency(stats.expenses)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Saldo</p>
                      <p className={`text-sm font-semibold ${balancePositive ? 'text-slate-700 dark:text-slate-200' : 'text-red-500'}`}>
                        {formatCurrency(stats.balance)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.05]">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {stats.count} lançamento{stats.count !== 1 ? 's' : ''} este mês
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8"
                      style={{ borderColor: board.color + '60', color: board.color }}
                      onClick={() => router.push(`/transactions/${board.id}`)}
                    >
                      Ver lançamentos
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL — template + form */}
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

      {/* DELETE CONFIRM */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir conta</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>? Os lançamentos vinculados a ela serão desvinculados (não apagados).
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteBoard(deleteTarget!.id); setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
