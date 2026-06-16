'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { TransactionTable } from '@/components/transactions/transaction-table'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { exportToCSV } from '@/utils/export-csv'
import { Button } from '@/components/ui/button'
import { Transaction, Category } from '@/types'
import { Plus, Download } from 'lucide-react'

export default function TransactionsPage() {
  const now = new Date()
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState<number | 'all'>(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const { transactions, loading, createTransaction, updateTransaction, deleteTransaction } =
    useTransactions({
      month: month === 'all' ? undefined : month,
      year,
      category,
      search,
    })

  function handleEdit(tx: Transaction) {
    setEditingTx(tx)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setEditingTx(null)
  }

  async function handleSubmit(data: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) {
    if (editingTx) {
      return updateTransaction(editingTx.id, data)
    }
    return createTransaction(data)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Transações</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {transactions.length} transação{transactions.length !== 1 ? 'ões' : ''} encontrada{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(transactions)}
            disabled={transactions.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Nova transação</span>
          </Button>
        </div>
      </div>

      <TransactionFilters
        search={search}
        month={month}
        year={year}
        category={category}
        onSearchChange={setSearch}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onCategoryChange={setCategory}
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-white rounded-lg animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={deleteTransaction}
        />
      )}

      <TransactionForm
        open={formOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={editingTx ?? undefined}
      />
    </div>
  )
}
