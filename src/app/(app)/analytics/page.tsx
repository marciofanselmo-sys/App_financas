'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useCategories } from '@/hooks/use-categories'
import { TrendingDown, TrendingUp, Wallet, BarChart2, Loader2, Zap, CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Transaction } from '@/types'
import { useRules, applyRuleToExisting } from '@/hooks/use-rules'

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
  const [selectedCategory, setSelectedCategory] = useState<{ cat: string; type: 'despesa' | 'receita' } | null>(null)

  const { boards } = useTransactionBoards()
  const { categories } = useCategories()
  const unpinnedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard).map(b => b.id),
    [boards]
  )
  const { createRule } = useRules()
  const [savingTxId, setSavingTxId] = useState<string | null>(null)

  // Rule creation from transaction
  interface RuleForm { txId: string; keyword: string; category: string }
  const [ruleForm, setRuleForm] = useState<RuleForm | null>(null)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleCreatedFor, setRuleCreatedFor] = useState<string | null>(null)

  function extractKeyword(desc: string): string {
    const words = desc.toUpperCase().split(/[\s\-_*.,/\\|:]+/).filter(w => w.length > 2 && !/^\d+$/.test(w))
    return words[0] ?? desc.toUpperCase().slice(0, 20)
  }

  function openRuleForm(tx: Transaction) {
    setRuleForm({ txId: tx.id, keyword: extractKeyword(tx.description), category: tx.category })
    setRuleCreatedFor(null)
  }

  async function handleCreateRule() {
    if (!ruleForm?.keyword || !ruleForm?.category) return
    setRuleSaving(true)
    const saved = await createRule(ruleForm.keyword.trim().toUpperCase(), ruleForm.category)
    if (saved) {
      await applyRuleToExisting({
        keyword: saved.keyword,
        match_type: saved.match_type ?? 'contains',
        category: saved.category,
        board_id: saved.board_id ?? null,
      })
      setRuleCreatedFor(ruleForm.txId)
    }
    setRuleSaving(false)
    setRuleForm(null)
  }
  const { transactions, loading, updateTransaction } = useTransactions({
    month,
    year,
    board_id: boardId === 'all' ? undefined : boardId,
    exclude_board_ids: boardId === 'all' ? unpinnedBoardIds : undefined,
  })

  const { totalIncome, totalExpenses, balance, expenseByCategory, incomeByCategory } = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    const expenseMap: Record<string, { total: number; count: number }> = {}
    const incomeMap: Record<string, { total: number; count: number }> = {}

    for (const t of transactions) {
      if (t.type === 'transferencia') continue
      const amt = Number(t.amount)
      if (t.type === 'receita') {
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

    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expenseByCategory, incomeByCategory }
  }, [transactions])

  const maxExpense = expenseByCategory[0]?.total ?? 1

  async function handleRecategorize(txId: string, newCategory: string) {
    setSavingTxId(txId)
    await updateTransaction(txId, { category: newCategory })
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
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Despesas por Categoria</h2>
              {boardId !== 'all' && (
                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {boards.find(b => b.id === boardId)?.name}
                </span>
              )}
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
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-green-500" />
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Entradas por Categoria</h2>
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
      <Dialog open={!!selectedCategory} onOpenChange={() => { setSelectedCategory(null); setRuleForm(null); setRuleCreatedFor(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedCategory ? colorFor(selectedCategory.cat) : '#6366f1' }}
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
                  <div key={tx.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${tx.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.type === 'despesa' ? '- ' : '+ '}{fmt(Number(tx.amount))}
                      </span>
                    </div>

                    {/* Inline category selector + create rule button */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {savingTxId === tx.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      <Select
                        value={tx.category}
                        onValueChange={v => v && v !== tx.category && handleRecategorize(tx.id, v)}
                        disabled={savingTxId === tx.id}
                      >
                        <SelectTrigger className="h-7 text-xs px-2 w-auto min-w-[140px] border-dashed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => (
                            <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {ruleCreatedFor === tx.id ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Regra criada!
                        </span>
                      ) : ruleForm?.txId === tx.id ? null : (
                        <button
                          onClick={() => openRuleForm(tx)}
                          title="Criar regra automática"
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>virar regra</span>
                        </button>
                      )}
                    </div>

                    {/* Inline rule form */}
                    {ruleForm?.txId === tx.id && (
                      <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl space-y-2">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Zap className="h-3.5 w-3.5" /> Nova regra automática
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Quando a descrição contiver a palavra-chave abaixo, a categoria será aplicada automaticamente.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            className="h-7 text-xs w-40 font-mono bg-white dark:bg-slate-800"
                            value={ruleForm.keyword}
                            onChange={e => setRuleForm(f => f ? { ...f, keyword: e.target.value.toUpperCase() } : f)}
                            placeholder="PALAVRA-CHAVE"
                            autoFocus
                          />
                          <Select
                            value={ruleForm.category}
                            onValueChange={v => v && setRuleForm(f => f ? { ...f, category: v } : f)}
                          >
                            <SelectTrigger className="h-7 text-xs w-auto min-w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map(c => (
                                <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                            disabled={!ruleForm.keyword || !ruleForm.category || ruleSaving}
                            onClick={handleCreateRule}
                          >
                            {ruleSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            Criar regra
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-slate-500"
                            onClick={() => setRuleForm(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3 flex justify-between items-center mt-2">
            <span className="text-xs text-slate-500">{categoryTxs.length} {categoryTxs.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            <span className={`text-sm font-bold ${selectedCategory?.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
              {fmt(categoryTxs.reduce((s, t) => s + Number(t.amount), 0))}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
