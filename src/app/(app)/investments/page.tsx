'use client'

import { useState } from 'react'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { usePositionImport } from '@/hooks/use-position-import'
import { TransactionBoard, BoardType, BOARD_COLORS, BOARD_ICONS, BoardIconKey } from '@/types'
import { formatCurrency, rentColor, CategorySummary, PositionsBreakdown, ProventosBreakdown } from '@/components/investments/rico-position-summary'
import { BoardIcon } from '@/components/transactions/board-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Pencil, Trash2, PiggyBank, ChevronRight, AlertTriangle,
  ChevronDown, ChevronUp, Upload, RefreshCw, AlertCircle, Pin, PinOff,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'

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
  icon: 'trending-up',
  description: '',
  type: 'ambos',
}

export default function InvestmentsPage() {
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

  const [expandedPos, setExpandedPos] = useState<Set<string>>(new Set())
  const [expandedProventos, setExpandedProventos] = useState<Set<string>>(new Set())

  const {
    fileRef: positionFileRef, preview: positionPreview, loading: positionLoading, error: positionImportError,
    open: openPositionImport, handleFile: handlePositionFile, confirm: confirmPositionImport,
    cancel: cancelPositionImport, dismissError: dismissPositionError,
  } = usePositionImport(updateBoard)

  // Fixar conta de investimento = entra SÓ nos totais dos Relatórios.
  // Dashboard e analytics excluem investimentos sempre, fixados ou não
  // (filtro `|| b.is_investment` nas duas páginas).
  function togglePinned(board: TransactionBoard) {
    updateBoard(board.id, { show_on_dashboard: !board.show_on_dashboard })
  }

  function togglePos(id: string) {
    setExpandedPos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function toggleProventos(id: string) {
    setExpandedProventos(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
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
      show_on_dashboard: editing?.show_on_dashboard ?? false,
    }
    if (editing) {
      updateBoard(editing.id, data)
    } else {
      await createBoard(data)
    }
    setFormOpen(false)
  }

  if (loading) return null

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Investimentos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {boards.length === 0 ? 'Adicione sua primeira conta de investimento' : `${boards.length} conta${boards.length > 1 ? 's' : ''} cadastrada${boards.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova conta
        </Button>
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
        <div className="space-y-4">
          {boards.map(board => {
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
                        title={board.show_on_dashboard ? 'Remover dos relatórios' : 'Incluir nos relatórios'}
                        onClick={() => togglePinned(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        {board.show_on_dashboard
                          ? <Pin className="h-3.5 w-3.5 text-blue-500" />
                          : <PinOff className="h-3.5 w-3.5 text-slate-400" />
                        }
                      </button>
                      <button
                        title={board.last_position_import ? 'Atualizar posição' : 'Importar posição'}
                        disabled={positionLoading}
                        onClick={() => openPositionImport(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        {positionLoading ? <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin" /> : <Upload className="h-3.5 w-3.5 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => openEdit(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(board)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Posição da carteira (PosicaoDetalhada.xlsx) — mesma organização de Metas.
                      Só leitura aqui — importar/atualizar só é feito dentro da conta. */}
                  <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3.5 mb-4">
                    {board.last_position_import ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Patrimônio (posição)</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatCurrency(board.last_position_import.patrimonio)}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {board.last_position_import.positions.length > 0 && (
                              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-slate-500" onClick={() => togglePos(board.id)}>
                                {expandedPos.has(board.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {board.last_position_import.positions.length} ativos
                              </Button>
                            )}
                            {board.last_position_import.proventos && board.last_position_import.proventos.length > 0 && (
                              <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-slate-500" onClick={() => toggleProventos(board.id)}>
                                {expandedProventos.has(board.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {board.last_position_import.proventos.length} rendimentos previstos
                              </Button>
                            )}
                          </div>
                        </div>
                        {board.last_position_import.positions.length > 0 && (
                          <div className="mt-3">
                            <CategorySummary positions={board.last_position_import.positions} />
                          </div>
                        )}
                        {expandedPos.has(board.id) && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <PositionsBreakdown positions={board.last_position_import.positions} />
                          </div>
                        )}
                        {expandedProventos.has(board.id) && board.last_position_import.proventos && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Próximos Rendimentos</p>
                            <ProventosBreakdown proventos={board.last_position_import.proventos} />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma posição da carteira importada ainda</p>
                    )}
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
