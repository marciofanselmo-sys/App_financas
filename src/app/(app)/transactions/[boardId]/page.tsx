'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useTransactions } from '@/hooks/use-transactions'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { ImportCSVModal } from '@/components/transactions/import-csv-modal'
import { BoardIcon } from '@/components/transactions/board-icon'
import { exportToCSV } from '@/utils/export-csv'
import { Transaction } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, Upload, Download, Search, X, FileUp, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { createClient } from '@/lib/supabase/client'

export default function BoardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const boardId = params.boardId as string

  const { boards, loading: boardsLoading } = useTransactionBoards()
  const board = boards.find(b => b.id === boardId)

  const now = new Date()
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSectionOpen, setImportSectionOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction, refetch } =
    useTransactions({
      board_id: boardId,
      month,
      year,
      search,
      tag: activeTag ?? undefined,
    })

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

  async function handleSubmit(data: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) {
    if (editingTx) return updateTransaction(editingTx.id, data)
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

      {/* Import Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <button
          onClick={() => setImportSectionOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: board.color + '20' }}>
              <FileUp className="h-3.5 w-3.5" style={{ color: board.color }} />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Importar dados para este quadro</span>
          </div>
          {importSectionOpen
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />
          }
        </button>

        {importSectionOpen && (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 mb-4">
              Importe lançamentos de extratos bancários (OFX/QFX) ou planilhas (CSV) diretamente para este quadro.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setImportOpen(true); setImportSectionOpen(false) }}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 p-4 hover:border-slate-400 dark:hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all text-left group"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Upload className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Extrato bancário</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">OFX, QFX ou CSV</p>
                </div>
              </button>

              <button
                onClick={() => { setImportOpen(true); setImportSectionOpen(false) }}
                className="flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 p-4 hover:border-slate-400 dark:hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-all text-left group"
              >
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                  <FileText className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Planilha CSV</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Formato personalizado</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <PeriodFilter
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />
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
    </div>
  )
}
