'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useCategories } from '@/hooks/use-categories'
import { TrendingDown, TrendingUp, Wallet, BarChart2, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Transaction, TRANSFER_CATEGORY_COLOR } from '@/types'
import { useRules } from '@/hooks/use-rules'
import { categoriesForDate } from '@/lib/special-category-filter'
import { installmentLabel } from '@/utils/format-installment'

const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação':  '#f59e0b',
  'Transporte':   '#3b82f6',
  'Moradia':      '#8b5cf6',
  'Saúde':        '#ef4444',
  'Educação':     '#ec4899',
  'Lazer':        '#f97316',
  'Salário':      '#10b981',
  'Freelance':    '#06b6d4',
  'Outros':       '#6b7280',
}

function colorFor(cat: string) {
  return CATEGORY_COLORS[cat] ?? '#6366f1'
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export default function AnalyticsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [boardId, setBoardId] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<{ cat: string; type: 'despesa' | 'receita' | 'transferencia' } | null>(null)

  const { boards } = useTransactionBoards()
  const { categories } = useCategories()
  const unpinnedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard).map(b => b.id),
    [boards]
  )
  const { syncCategoryToRule } = useRules()
  const [savingTxId, setSavingTxId] = useState<string | null>(null)

  const { transactions, loading, updateTransaction, refetch } = useTransactions({
    month,
    year,
    board_id: boardId === 'all' ? undefined : boardId,
    exclude_board_ids: boardId === 'all' ? unpinnedBoardIds : undefined,
  })

  const { totalIncome, totalExpenses, totalTransfers, balance, expenseByCategory, incomeByCategory, transferByCategory } = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    let totalTransfers = 0
    const expenseMap: Record<string, { total: number; count: number }> = {}
    const incomeMap: Record<string, { total: number; count: number }> = {}
    const transferMap: Record<string, { total: number; count: number }> = {}

    for (const t of transactions) {
      const amt = Number(t.amount)
      if (t.type === 'transferencia') {
        totalTransfers += amt
        transferMap[t.category] = transferMap[t.category] ?? { total: 0, count: 0 }
        transferMap[t.category].total += amt
        transferMap[t.category].count += 1
      } else if (t.type === 'receita') {
        totalIncome += amt
        incomeMap[t.category] = incomeMap[t.category] ?? { total: 0, count: 0 }
        incomeMap[t.category].total += amt
        incomeMap[t.category].count += 1
      } else {
        totalExpenses += amt
        expenseMap[t.category] = expenseMap[t.category] ?? { total: 0, count: 0 }
        expenseMap[t.category].total += amt
        expenseMap[t.category].count += 1
      }
    }

    const expenseByCategory = Object.entries(expenseMap)
      .map(([cat, d]) => ({ cat, total: d.total, count: d.count, pct: totalExpenses > 0 ? (d.total / totalExpenses) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)

    const incomeByCategory = Object.entries(incomeMap)
      .map(([cat, d]) => ({ cat, total: d.total, count: d.count, pct: totalIncome > 0 ? (d.total / totalIncome) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)

    const transferByCategory = Object.entries(transferMap)
      .map(([cat, d]) => ({ cat, total: d.total, count: d.count, pct: totalTransfers > 0 ? (d.total / totalTransfers) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)

    return { totalIncome, totalExpenses, totalTransfers, balance: totalIncome - totalExpenses, expenseByCategory, incomeByCategory, transferByCategory }
  }, [transactions])

  const maxExpense = expenseByCategory[0]?.total ?? 1
  const maxTransfer = transferByCategory[0]?.total ?? 1

  async function handleRecategorize(txId: string, newCategory: string) {
    const tx = transactions.find(t => t.id === txId)
    setSavingTxId(txId)
    await updateTransaction(txId, { category: newCategory })
    // Categoria normal: "gruda" em todas as transações com esse nome exato via
    // regra automática (categoria especial nunca entra aqui).
    if (tx) {
      const syncResult = await syncCategoryToRule(tx.description, newCategory, categories)
      if (syncResult.error) console.error('[handleRecategorize] syncCategoryToRule falhou:', syncResult.error)
      refetch()
    }
    setSavingTxId(null)
  }

  const categoryTxs: Transaction[] = useMemo(() => {
    if (!selectedCategory) return []
    return transactions.filter(
      t => t.category === selectedCategory.cat && t.type === selectedCategory.type
    ).sort((a, b) => b.date.localeCompare(a.date))
  }, [selectedCategory, transactions])

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Análise de Gastos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entradas, saídas e distribuição por categoria</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />

          <select
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Todas as contas</option>
            {boards.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Entradas</p>
              <p className="text-xl font-bold text-green-600">{fmt(totalIncome)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saídas</p>
              <p className="text-xl font-bold text-red-500">{fmt(totalExpenses)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
              <Wallet className={`h-5 w-5 ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo do período</p>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>{fmt(balance)}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <EmptyState
          icon={BarChart2}
          iconColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-500/15"
          title="Sem dados para este período"
          description="Adicione movimentações ou importe um extrato para visualizar a análise de gastos por categoria."
          primaryLabel="Adicionar movimentação"
          primaryHref="/transactions"
          secondaryLabel="Importar extrato"
          secondaryHref="/transactions"
        />
      )}

      {!loading && transactions.length > 0 && (
        <>
          {/* Expense breakdown */}
          <section>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-red-500" />
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Despesas por Categoria</h2>
                {boardId !== 'all' && (
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {boards.find(b => b.id === boardId)?.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-6">
                Quanto saiu de verdade neste período, agrupado por categoria. Conta no saldo e no planejamento.
              </p>
            </div>

            {expenseByCategory.length === 0 ? (
              <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                <p className="text-sm text-slate-400">Nenhuma despesa neste período.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                {/* Bar chart section */}
                <div className="p-5 space-y-3">
                  {expenseByCategory.map(({ cat, total, count, pct }) => (
                    <button
                      key={cat}
                      className="w-full text-left group"
                      onClick={() => setSelectedCategory({ cat, type: 'despesa' })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: colorFor(cat) }}
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:underline">{cat}</span>
                          <span className="text-xs text-slate-400">({count} {count === 1 ? 'lançamento' : 'lançamentos'})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold text-red-500 w-28 text-right">{fmt(total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(total / maxExpense) * 100}%`,
                            backgroundColor: colorFor(cat),
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Totals footer */}
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de despesas</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(totalExpenses)}</span>
                </div>
              </div>
            )}
          </section>

          {/* Income breakdown */}
          {incomeByCategory.length > 0 && (
            <section>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-green-500" />
                  <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Entradas por Categoria</h2>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-6">
                  Quanto entrou de verdade neste período, agrupado por categoria. Conta no saldo e no planejamento.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 space-y-3">
                  {incomeByCategory.map(({ cat, total, count, pct }) => {
                    const maxIncome = incomeByCategory[0]?.total ?? 1
                    return (
                      <button
                        key={cat}
                        className="w-full text-left group"
                        onClick={() => setSelectedCategory({ cat, type: 'receita' })}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: colorFor(cat) }}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:underline">{cat}</span>
                            <span className="text-xs text-slate-400">({count} {count === 1 ? 'lançamento' : 'lançamentos'})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                            <span className="text-sm font-semibold text-green-600 w-28 text-right">{fmt(total)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${(total / maxIncome) * 100}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de entradas</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(totalIncome)}</span>
                </div>
              </div>
            </section>
          )}

          {/* Transfer breakdown — sempre na cor cinza de transferência, não por categoria. Fica sempre por último. */}
          {transferByCategory.length > 0 && (
            <section>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-slate-400" />
                  <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Transferências por Categoria</h2>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-6">
                  Movimentação entre suas próprias contas (ex: pagar fatura, aplicar num investimento) — não é gasto nem ganho real, por isso fica fora do saldo e do planejamento.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="p-5 space-y-3">
                  {transferByCategory.map(({ cat, total, count, pct }) => (
                    <button
                      key={cat}
                      className="w-full text-left group"
                      onClick={() => setSelectedCategory({ cat, type: 'transferencia' })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: TRANSFER_CATEGORY_COLOR }}
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:underline">{cat}</span>
                          <span className="text-xs text-slate-400">({count} {count === 1 ? 'lançamento' : 'lançamentos'})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 w-28 text-right">{fmt(total)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(total / maxTransfer) * 100}%`, backgroundColor: TRANSFER_CATEGORY_COLOR }}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total transferido</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{fmt(totalTransfers)}</span>
                </div>
              </div>
            </section>
          )}

          {/* Quick link to recurring */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Ver parcelamentos ativos</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Parcelas em andamento com barra de progresso e data de término</p>
            </div>
            <Link
              href="/recurring"
              className="shrink-0 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
            >
              Ir para Recorrências →
            </Link>
          </div>
        </>
      )}

      {/* Category detail dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: !selectedCategory
                    ? '#6366f1'
                    : selectedCategory.type === 'transferencia'
                      ? TRANSFER_CATEGORY_COLOR
                      : colorFor(selectedCategory.cat),
                }}
              />
              {selectedCategory?.cat}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            {categoryTxs.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Nenhum lançamento encontrado.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {categoryTxs.map(tx => (
                  <div key={tx.id} className="py-3 flex items-center gap-3">
                    {/* Coluna 1: descrição + data (+ parcela, se houver) */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{tx.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        {installmentLabel(tx) && ` · Parcela ${installmentLabel(tx)}`}
                      </p>
                    </div>

                    {/* Coluna 2: categoria — muda só essa transação; se for categoria
                        normal, a regra automática cuida de propagar pro histórico */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {savingTxId === tx.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      <Select
                        value={tx.category}
                        onValueChange={v => v && v !== tx.category && handleRecategorize(tx.id, v)}
                        disabled={savingTxId === tx.id}
                      >
                        <SelectTrigger className="h-7 text-xs px-2 w-auto min-w-[120px] border-dashed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesForDate(categories, tx.date)
                            .filter(c => c.type === tx.type || c.type === 'ambos')
                            .map(c => (
                              <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Coluna 3: valor */}
                    <span className={`text-sm font-semibold shrink-0 w-24 text-right ${tx.type === 'receita' ? 'text-green-600' : tx.type === 'transferencia' ? 'text-slate-400' : 'text-red-500'}`}>
                      {tx.type === 'receita' ? '+ ' : tx.type === 'transferencia' ? '' : '- '}{fmt(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3 flex justify-between items-center mt-2">
            <span className="text-xs text-slate-500">{categoryTxs.length} {categoryTxs.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            <span className={`text-sm font-bold ${selectedCategory?.type === 'receita' ? 'text-green-600' : selectedCategory?.type === 'transferencia' ? 'text-slate-500 dark:text-slate-400' : 'text-red-500'}`}>
              {fmt(categoryTxs.reduce((s, t) => s + Number(t.amount), 0))}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
