'use client'

import { useState, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useTransactions } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { useRules, applyTypeToExisting } from '@/hooks/use-rules'
import { usePositionImport } from '@/hooks/use-position-import'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { ImportCSVModal } from '@/components/transactions/import-csv-modal'
import { BoardIcon } from '@/components/transactions/board-icon'
import { formatCurrency, rentColor, CategorySummary, PositionsBreakdown, ProventosBreakdown } from '@/components/investments/rico-position-summary'
import { exportToCSV } from '@/utils/export-csv'
import { Transaction, TransactionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, Plus, Upload, Download, Search, X,
  ChevronDown, ChevronUp, RefreshCw, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { createClient } from '@/lib/supabase/client'

const TYPE_FILTER_OPTIONS: { value: 'all' | TransactionType; label: string }[] = [
  { value: 'all', label: 'Todos os Tipos' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'receita', label: 'Receita' },
  { value: 'transferencia', label: 'Transferência' },
]

const TYPE_LABELS: Record<TransactionType, string> = {
  despesa: 'Despesa',
  receita: 'Receita',
  transferencia: 'Transferência',
}

export default function BoardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const boardId = params.boardId as string

  const { boards, loading: boardsLoading, updateBoard } = useTransactionBoards()
  const board = boards.find(b => b.id === boardId)
  const { categories } = useCategories()
  const { syncCategoryToRule } = useRules()
  // Conta de investimento é sempre atualizada com o extrato inteiro (não faz
  // sentido filtrar rendimentos/dividendos/histórico de ativos por mês) —
  // diferente de conta corrente, que continua abrindo no mês atual.
  const isInvestmentBoard = board?.is_investment ?? false
  const {
    fileRef: positionFileRef, preview: positionPreview, loading: positionLoading, error: positionImportError,
    open: openPositionImport, handleFile: handlePositionFile, confirm: confirmPositionImport,
    cancel: cancelPositionImport, dismissError: dismissPositionError,
  } = usePositionImport(updateBoard)

  const now = new Date()
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [expandedPos, setExpandedPos] = useState(false)
  const [expandedProventos, setExpandedProventos] = useState(false)
  const [ruleSyncError, setRuleSyncError] = useState<string | null>(null)
  const [ruleSyncSuccess, setRuleSyncSuccess] = useState<{
    category?: { name: string; applied: number }
    type?: { value: TransactionType; applied: number }
  } | null>(null)

  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction, refetch } =
    useTransactions({
      board_id: boardId,
      ...(isInvestmentBoard ? {} : { month, year }),
      search,
      tag: activeTag ?? undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
    })

  // Se o tipo selecionado mudar, uma categoria já escolhida que não pertence
  // mais a esse tipo (e não é "Ambos") deixa de fazer sentido como filtro.
  const categoryOptions = useMemo(
    () => typeFilter === 'all' ? categories : categories.filter(c => c.type === typeFilter || c.type === 'ambos'),
    [categories, typeFilter],
  )
  // O componente de Select (base-ui) só resolve o rótulo do valor selecionado
  // via este `items` — sem ele, mostra o valor bruto ("all") em vez do texto
  // amigável até o usuário abrir o dropdown pela primeira vez.
  const categoryFilterItems = useMemo(
    () => [{ value: 'all', label: 'Todas as Categorias' }, ...categoryOptions.map(c => ({ value: c.name, label: c.name }))],
    [categoryOptions],
  )
  const hasExtraFilters = categoryFilter !== 'all' || typeFilter !== 'all'
  function clearExtraFilters() {
    setCategoryFilter('all')
    setTypeFilter('all')
  }

  useEffect(() => {
    if (categoryFilter === 'all') return
    const stillValid = categoryOptions.some(c => c.name === categoryFilter)
    if (!stillValid) setCategoryFilter('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter])

  // Entradas / Saídas / Saldo / Transferências do que está na tela (respeita mês e filtros)
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
    const transfers = transactions.filter(t => t.type === 'transferencia').reduce((s, t) => s + Number(t.amount), 0)
    return { income, expenses, balance: income - expenses, transfers }
  }, [transactions])

  // collect all tags from all transactions for this board (no filters applied)
  const { transactions: allBoardTxs } = useTransactions({ board_id: boardId })
  const allTags = useMemo(() => {
    const set = new Set<string>()
    allBoardTxs.forEach(t => (t.tags ?? []).forEach(tag => set.add(tag)))
    return Array.from(set).sort()
  }, [allBoardTxs])

  function handleEdit(tx: Transaction) {
    setEditingTx(tx)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setEditingTx(null)
  }

  async function handleSubmit(data: Omit<Transaction, 'id' | 'user_id' | 'created_at'>, options?: { skipRuleSync?: boolean }) {
    if (editingTx) {
      const result = await updateTransaction(editingTx.id, data)
      // Categoria E Tipo mudados de verdade "grudam" em todas as transações com
      // esse nome exato (categoria especial nunca entra aqui). Antes, só a
      // categoria propagava — mudar o Tipo (ex: Despesa -> Transferência) pra
      // corrigir uma classificação errada deixava as outras transações da mesma
      // descrição presas no tipo antigo. Usuário marca "só esta transação" no
      // formulário pra pular os dois quando não quiser esse comportamento.
      if (!result.error && !options?.skipRuleSync) {
        const categoryChanged = data.category && data.category !== editingTx.category
        const typeChanged = data.type !== editingTx.type
        if (categoryChanged || typeChanged) {
          setRuleSyncSuccess(null)
          const success: NonNullable<typeof ruleSyncSuccess> = {}
          let firstError: string | undefined

          if (categoryChanged) {
            const syncResult = await syncCategoryToRule(data.description, data.category, categories)
            if (syncResult.error) {
              console.error('[handleSubmit] syncCategoryToRule falhou:', syncResult.error)
              firstError = syncResult.error
            } else {
              success.category = { name: data.category, applied: syncResult.applied }
            }
          }

          if (typeChanged) {
            const typeResult = await applyTypeToExisting(data.description, data.type)
            if (typeResult.error) {
              console.error('[handleSubmit] applyTypeToExisting falhou:', typeResult.error)
              firstError = firstError ?? typeResult.error
            } else {
              success.type = { value: data.type, applied: typeResult.count }
            }
          }

          setRuleSyncError(firstError ?? null)
          if (success.category || success.type) setRuleSyncSuccess(success)
          refetch()
        }
      }
      return result
    }
    return createTransaction({ ...data, board_id: boardId })
  }

  async function handleToggleRecurring(tx: Transaction) {
    await updateTransaction(tx.id, { is_recurring: !tx.is_recurring })
    // Clear any recurring_decisions entry so Recorrências shows correct pending state
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('recurring_decisions')
        .delete()
        .eq('user_id', user.id)
        .eq('description_key', tx.description.toLowerCase().trim())
    }
  }

  async function handleBulkCategoryChange(ids: string[], category: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').update({ category }).eq('user_id', user.id).in('id', ids)
    refetch()
  }

  async function handleBulkMove(ids: string[], newBoardId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').update({ board_id: newBoardId }).eq('user_id', user.id).in('id', ids)
    refetch()
  }

  async function handleBulkDelete(ids: string[]) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transactions').delete().eq('user_id', user.id).in('id', ids)
    refetch()
  }

  async function handleSubmitBatch(items: Omit<Transaction, 'id' | 'user_id' | 'created_at'>[]) {
    let lastError: unknown = null
    for (const item of items) {
      const { error } = await createTransaction({ ...item, board_id: boardId })
      if (error) { lastError = error; break }
    }
    return { error: lastError }
  }

  if (boardsLoading) return null

  if (!board) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-slate-500 dark:text-slate-400">Quadro não encontrado.</p>
        <Button variant="outline" onClick={() => router.push('/transactions')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Erro ao sincronizar a regra automática — antes só ia pro console do
          navegador, invisível pro usuário; agora aparece aqui. */}
      {ruleSyncError && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Transação salva, mas a atualização retroativa falhou</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{ruleSyncError}</p>
          </div>
          <button onClick={() => setRuleSyncError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmação de sucesso — antes, criar/atualizar a regra com sucesso e
          pular ela (checkbox marcado) pareciam a mesma coisa (nada aparecia). */}
      {ruleSyncSuccess && (ruleSyncSuccess.category || ruleSyncSuccess.type) && (
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            {ruleSyncSuccess.category && (
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Regra de categoria criada/atualizada: &ldquo;{ruleSyncSuccess.category.name}&rdquo;</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {ruleSyncSuccess.category.applied > 0
                    ? `${ruleSyncSuccess.category.applied} transação${ruleSyncSuccess.category.applied !== 1 ? 'ões' : ''} com a mesma descrição também foi${ruleSyncSuccess.category.applied !== 1 ? 'ram' : ''} atualizada${ruleSyncSuccess.category.applied !== 1 ? 's' : ''}.`
                    : 'Nenhuma outra transação com a mesma descrição encontrada.'}
                </p>
              </div>
            )}
            {ruleSyncSuccess.type && (
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Tipo atualizado: &ldquo;{TYPE_LABELS[ruleSyncSuccess.type.value]}&rdquo;</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {ruleSyncSuccess.type.applied > 0
                    ? `${ruleSyncSuccess.type.applied} transação${ruleSyncSuccess.type.applied !== 1 ? 'ões' : ''} com a mesma descrição também foi${ruleSyncSuccess.type.applied !== 1 ? 'ram' : ''} atualizada${ruleSyncSuccess.type.applied !== 1 ? 's' : ''}.`
                    : 'Nenhuma outra transação com a mesma descrição encontrada.'}
                </p>
              </div>
            )}
          </div>
          <button onClick={() => setRuleSyncSuccess(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/transactions')}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </button>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: board.color + '20' }}>
            <BoardIcon icon={board.icon} className="h-5 w-5" style={{ color: board.color }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{board.name}</h1>
            {board.description && (
              <p className="text-xs text-slate-400 dark:text-slate-500">{board.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Importar extrato</span>
          </Button>
          {isInvestmentBoard && (
            <Button
              variant="outline" size="sm" className="gap-2"
              disabled={positionLoading}
              onClick={() => openPositionImport(board)}
            >
              {positionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">{board.last_position_import ? 'Atualizar posição' : 'Importar posição'}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportToCSV(transactions)} disabled={transactions.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova transação
          </Button>
        </div>
      </div>

      {/* Entradas / Saídas / Saldo / Transferências — reflete o período e os filtros ativos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-4 text-center shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Entradas</p>
          <p className="text-sm sm:text-base font-semibold text-green-600">{formatCurrency(stats.income)}</p>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-4 text-center shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Saídas</p>
          <p className="text-sm sm:text-base font-semibold text-red-500">{formatCurrency(stats.expenses)}</p>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-4 text-center shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Saldo</p>
          <p className={`text-sm sm:text-base font-semibold ${stats.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
            {formatCurrency(stats.balance)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-4 text-center shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Transferências</p>
          <p className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(stats.transfers)}</p>
        </div>
      </div>

      {/* Posição da carteira — só pra conta de investimento */}
      {isInvestmentBoard && board.last_position_import && (
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Patrimônio (posição)</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatCurrency(board.last_position_import.patrimonio)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {board.last_position_import.positions.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-slate-500" onClick={() => setExpandedPos(v => !v)}>
                  {expandedPos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {board.last_position_import.positions.length} ativos
                </Button>
              )}
              {board.last_position_import.proventos && board.last_position_import.proventos.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs gap-1 h-8 text-slate-500" onClick={() => setExpandedProventos(v => !v)}>
                  {expandedProventos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
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
          {expandedPos && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <PositionsBreakdown positions={board.last_position_import.positions} />
            </div>
          )}
          {expandedProventos && board.last_position_import.proventos && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Próximos Rendimentos</p>
              <ProventosBreakdown proventos={board.last_position_import.proventos} />
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] shadow-sm focus-visible:ring-blue-500/50"
          />
        </div>

        {!isInvestmentBoard && (
          <PeriodFilter
            month={month}
            year={year}
            onMonthChange={setMonth}
            onYearChange={setYear}
          />
        )}

        <Select value={typeFilter} onValueChange={v => setTypeFilter((v ?? 'all') as 'all' | TransactionType)} items={TYPE_FILTER_OPTIONS}>
          <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] shadow-sm focus-visible:ring-blue-500/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')} items={categoryFilterItems}>
          <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] shadow-sm focus-visible:ring-blue-500/50">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {categoryOptions.map(cat => (
              <SelectItem key={cat.id} value={cat.name}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasExtraFilters && (
          <button onClick={clearExtraFilters} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTags.map(tag => (
            <Badge
              key={tag}
              variant={activeTag === tag ? 'default' : 'secondary'}
              className="cursor-pointer text-xs gap-1 select-none"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
              {activeTag === tag && <X className="h-3 w-3" />}
            </Badge>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">
              Limpar filtro
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-white dark:bg-slate-800 rounded-lg animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={deleteTransaction}
          onMove={async (txId, newBoardId) => updateTransaction(txId, { board_id: newBoardId })}
          onToggleRecurring={handleToggleRecurring}
          boards={boards}
          currentBoardId={boardId}
          categories={categories}
          onBulkCategoryChange={handleBulkCategoryChange}
          onBulkMove={handleBulkMove}
          onBulkDelete={handleBulkDelete}
        />
      )}

      <TransactionForm
        open={formOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        onSubmitBatch={handleSubmitBatch}
        initialData={editingTx ?? undefined}
        boardId={boardId}
      />

      <ImportCSVModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetch}
        boardId={boardId}
      />

      {isInvestmentBoard && (
        <>
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
        </>
      )}
    </div>
  )
}
