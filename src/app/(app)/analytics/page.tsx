'use client'

import { useState, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { useCategories } from '@/hooks/use-categories'
import { TrendingDown, TrendingUp, Wallet, BarChart2, Loader2, AlertCircle, CheckCircle2, X, ArrowLeftRight, ChevronRight, ChevronDown, Tag } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Transaction } from '@/types'
import { useRules } from '@/hooks/use-rules'
import { categoriesForDate } from '@/lib/special-category-filter'
import { CategoryOptions } from '@/components/categories/category-options'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { isInternalMovement, internalTotals } from '@/lib/internal-movement'
import { installmentLabel } from '@/utils/format-installment'
import { aggregateDailyFlow } from '@/lib/analytics-charts'
import { DailyFlowChart } from '@/components/analytics/daily-flow-chart'

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

// Cabeçalho clicável de cada categoria da lista (despesas e entradas): seta
// que gira ao abrir, nome e detalhe à esquerda, valor e % à direita — em duas
// linhas, pra caber no celular sem cortar o valor.
function CategoryRowHeader({ name, open, detail, pct, value, valueClass }: {
  name: string
  open: boolean
  detail: string
  pct: number
  value: string
  valueClass: string
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:underline">{name}</p>
        <p className="text-[11px] text-slate-400">{detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold whitespace-nowrap ${valueClass}`}>{value}</p>
        <p className="text-[11px] text-slate-400">{pct.toFixed(0)}%</p>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [boardId, setBoardId] = useState<string>('all')
  // Categoria aberta na lista, mostrando os lançamentos dela ali mesmo.
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  // Começa sempre recolhido ao abrir a tela.
  const [internalOpen, setInternalOpen] = useState(false)
  const toggleInternal = () => setInternalOpen(v => !v)

  const { boards } = useTransactionBoards()
  const { categories } = useCategories()
  // Investimento nunca entra no analytics, mesmo fixado — o alfinete de
  // conta de investimento só inclui a conta nos Relatórios.
  const unpinnedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards]
  )
  const { syncCategoryToRule } = useRules()
  const [savingTxId, setSavingTxId] = useState<string | null>(null)
  const [ruleSyncError, setRuleSyncError] = useState<string | null>(null)
  const [ruleSyncSuccess, setRuleSyncSuccess] = useState<{ category: string; applied: number } | null>(null)

  const { transactions, loading, updateTransaction, refetch } = useTransactions({
    month,
    year,
    board_id: boardId === 'all' ? undefined : boardId,
    exclude_board_ids: boardId === 'all' ? unpinnedBoardIds : undefined,
  })

  const { totalIncome, totalExpenses, balance, expenseByCategory, incomeByCategory } = useMemo(() => {
    let totalIncome = 0
    let totalExpenses = 0
    // Soma pela categoria-mãe e guarda o detalhe por subcategoria dentro dela.
    const mothers = motherNameByCategory(categories)
    type Bucket = { total: number; count: number; txs: Transaction[]; subs: Record<string, { total: number; count: number }> }
    const expenseMap: Record<string, Bucket> = {}
    const incomeMap: Record<string, Bucket> = {}

    for (const t of transactions) {
      // Movimentação entre contas do próprio usuário não é gasto nem ganho.
      if (isInternalMovement(t)) continue
      const amt = Number(t.amount)
      const mother = motherOf(t.category, mothers, t.type)
      const target = t.type === 'receita' ? incomeMap : expenseMap
      if (t.type === 'receita') totalIncome += amt
      else totalExpenses += amt

      const bucket = target[mother] ?? (target[mother] = { total: 0, count: 0, txs: [], subs: {} })
      bucket.total += amt
      bucket.count += 1
      bucket.txs.push(t)
      if (t.category !== mother) {
        const sub = bucket.subs[t.category] ?? (bucket.subs[t.category] = { total: 0, count: 0 })
        sub.total += amt
        sub.count += 1
      }
    }

    const toList = (map: Record<string, Bucket>, total: number) =>
      Object.entries(map)
        .map(([cat, d]) => ({
          cat,
          total: d.total,
          count: d.count,
          pct: total > 0 ? (d.total / total) * 100 : 0,
          txs: [...d.txs].sort((a, b) => b.date.localeCompare(a.date)),
          subs: Object.entries(d.subs)
            .map(([name, sd]) => ({ name, total: sd.total, count: sd.count }))
            .sort((a, b) => b.total - a.total),
        }))
        .sort((a, b) => b.total - a.total)

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      expenseByCategory: toList(expenseMap, totalExpenses),
      incomeByCategory: toList(incomeMap, totalIncome),
    }
  }, [transactions, categories])

  const maxExpense = expenseByCategory[0]?.total ?? 1

  async function handleRecategorize(txId: string, newCategory: string) {
    const tx = transactions.find(t => t.id === txId)
    setSavingTxId(txId)
    await updateTransaction(txId, { category: newCategory })
    // Categoria normal: "gruda" em todas as transações com esse nome exato via
    // também entra normalmente (decisão revertida em 2026-07-08).
    if (tx) {
      setRuleSyncSuccess(null)
      const syncResult = await syncCategoryToRule(tx.description, newCategory, categories)
      if (syncResult.error) {
        console.error('[handleRecategorize] syncCategoryToRule falhou:', syncResult.error)
        setRuleSyncError(syncResult.error)
      } else {
        setRuleSyncError(null)
        setRuleSyncSuccess({ category: newCategory, applied: syncResult.applied })
      }
      refetch()
    }
    setSavingTxId(null)
  }

  // Lançamentos da categoria aberta, direto na lista — sem pop-up.
  // Cada linha deixa trocar a categoria ali mesmo (regra automática propaga).
  function renderTxList(txs: Transaction[]) {
    return (
      <div className="mt-2 ml-1.5 pl-3 border-l-2 border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
        {txs.map(tx => {
          const usable = categoriesForDate(categories, tx.date).filter(c => c.type === tx.type || c.type === 'ambos')
          return (
            // Duas linhas compactas: descrição + valor em cima; data/parcela +
            // seletor de categoria embaixo — cabe no celular sem espremer.
            <div key={tx.id} className="py-2">
              <div className="flex items-baseline gap-2">
                <p className="flex-1 min-w-0 text-[13px] text-slate-700 dark:text-slate-200 truncate">{tx.description}</p>
                <span className={`text-[13px] font-medium tabular-nums shrink-0 ${tx.type === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                  {fmt(Number(tx.amount))}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="flex-1 min-w-0 text-[11px] text-slate-400 truncate">
                  {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  {installmentLabel(tx) && ` · Parcela ${installmentLabel(tx)}`}
                </p>
                {savingTxId === tx.id && <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0" />}
                <Select
                  value={tx.category}
                  onValueChange={v => v && v !== tx.category && handleRecategorize(tx.id, v)}
                  disabled={savingTxId === tx.id}
                >
                  <SelectTrigger className="h-6 text-[11px] px-2 w-auto max-w-[150px] shrink-0 border-dashed">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <CategoryOptions list={usable} all={categories} className="text-xs" />
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Só para mostrar à parte — nada some sem explicação.
  const internal = useMemo(() => internalTotals(transactions), [transactions])

  const dailyFlowData = useMemo(
    () => aggregateDailyFlow(transactions, month, year),
    [transactions, month, year],
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Erro ao sincronizar a regra automática — antes só ia pro console do
          navegador, invisível pro usuário; agora aparece aqui. */}
      {ruleSyncError && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Categoria salva, mas a regra automática falhou</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{ruleSyncError}</p>
          </div>
          <button onClick={() => setRuleSyncError(null)} className="text-red-400 hover:text-red-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmação de sucesso — antes, criar/atualizar a regra com sucesso
          não mostrava nada na tela. */}
      {ruleSyncSuccess && (
        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Regra criada/atualizada: &ldquo;{ruleSyncSuccess.category}&rdquo;</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              {ruleSyncSuccess.applied > 0
                ? `${ruleSyncSuccess.applied} transação${ruleSyncSuccess.applied !== 1 ? 'ões' : ''} com a mesma descrição também foi${ruleSyncSuccess.applied !== 1 ? 'ram' : ''} atualizada${ruleSyncSuccess.applied !== 1 ? 's' : ''}.`
                : 'Nenhuma outra transação com a mesma descrição encontrada.'}
            </p>
          </div>
          <button onClick={() => setRuleSyncSuccess(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Análise de Gastos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Entradas, saídas e distribuição por categoria</p>
        </div>

        {/* Filters — mês e conta na mesma linha, também no celular */}
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          </div>

          <select
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
            className="flex-1 min-w-0 sm:flex-none h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Todas as contas</option>
            {boards.filter(b => !b.is_investment).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards — lado a lado também no celular; lá o ícone some
          para os três valores caberem */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 sm:h-24 bg-white dark:bg-slate-800 rounded-xl animate-pulse shadow-sm" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {([
            { label: 'Entradas', short: 'Entradas', value: totalIncome, icon: TrendingUp, iconCls: 'bg-green-50 dark:bg-green-900/30 text-green-500', valueCls: 'text-green-600' },
            { label: 'Saídas', short: 'Saídas', value: totalExpenses, icon: TrendingDown, iconCls: 'bg-red-50 dark:bg-red-900/30 text-red-500', valueCls: 'text-red-500' },
            // Saldo: azul quando positivo, vermelho quando negativo (padrão do app).
            {
              label: 'Saldo do período', short: 'Saldo', value: balance, icon: Wallet,
              iconCls: balance >= 0 ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'bg-red-50 dark:bg-red-900/30 text-red-500',
              valueCls: balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500',
            },
          ] as const).map(card => (
            <div
              key={card.label}
              className="bg-white dark:bg-slate-800 rounded-xl px-2 py-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center sm:justify-start gap-4 min-w-0"
            >
              <div className={`hidden sm:flex h-10 w-10 rounded-full items-center justify-center shrink-0 ${card.iconCls}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="sm:hidden">{card.short}</span>
                  <span className="hidden sm:inline">{card.label}</span>
                </p>
                <p className={`text-[13px] sm:text-xl font-bold tabular-nums truncate ${card.valueCls}`}>{fmt(card.value)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recolhível: fechado, vira uma linha só com o resumo */}
      {!loading && internal.count > 0 && (
        <button
          type="button"
          onClick={toggleInternal}
          aria-expanded={internalOpen}
          className="w-full text-left flex items-start gap-2.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl p-3.5"
        >
          <ArrowLeftRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          {!internalOpen ? (
            <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
              <strong className="text-slate-600 dark:text-slate-300">Entre suas contas:</strong>{' '}
              {internal.count} lançamento{internal.count === 1 ? '' : 's'} fora dos totais
            </p>
          ) : (
          <p className="flex-1 text-xs text-slate-500 dark:text-slate-400">
            <strong className="text-slate-600 dark:text-slate-300">Entre suas contas:</strong>{' '}
            {internal.out > 0.005 && <>{fmt(internal.out)} saíram</>}
            {internal.out > 0.005 && internal.in > 0.005 && ' e '}
            {internal.in > 0.005 && <>{fmt(internal.in)} entraram</>}
            {' '}em {internal.count} lançamento{internal.count === 1 ? '' : 's'} marcados como movimentação
            entre contas suas (pagamento de fatura, transferência). Eles aparecem no extrato e no saldo
            das contas, mas ficam <strong>fora</strong> dos totais acima — não são gasto nem ganho.
          </p>
          )}
          {internalOpen
            ? <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            : <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
        </button>
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
          <DailyFlowChart data={dailyFlowData} month={month} year={year} />

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
                  {expenseByCategory.map(({ cat, total, count, pct, subs, txs }) => {
                    const open = expandedCat === `despesa:${cat}`
                    return (
                      <div key={cat}>
                        <button
                          className="w-full text-left group"
                          onClick={() => setExpandedCat(open ? null : `despesa:${cat}`)}
                        >
                          <CategoryRowHeader
                            name={cat}
                            open={open}
                            detail={`${count} ${count === 1 ? 'lançamento' : 'lançamentos'}${subs.length > 0 ? ` · ${subs.length} subcategoria${subs.length === 1 ? '' : 's'}` : ''}`}
                            pct={pct}
                            value={fmt(total)}
                            valueClass="text-red-500"
                          />
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

                        {open && (
                          <>
                            {/* Subcategorias em linhas, como nos Relatórios. */}
                            {subs.length > 0 && (
                              <div className="mt-2 ml-1.5 pl-3 border-l-2 border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 pt-1 pb-0.5">Subcategorias</p>
                                {subs.map(sub => (
                                  <div key={sub.name} className="flex items-center gap-2 py-1">
                                    <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="flex-1 min-w-0 text-[13px] text-slate-600 dark:text-slate-300 truncate">{sub.name}</span>
                                    <span className="text-[11px] text-slate-400 shrink-0">{sub.count} {sub.count === 1 ? 'lançamento' : 'lançamentos'}</span>
                                    <span className="text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-200 shrink-0 w-24 text-right">{fmt(sub.total)}</span>
                                  </div>
                                ))}
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 pt-2">Lançamentos</p>
                              </div>
                            )}
                            {renderTxList(txs)}
                          </>
                        )}
                      </div>
                    )
                  })}
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
                  {incomeByCategory.map(({ cat, total, count, pct, txs }) => {
                    const maxIncome = incomeByCategory[0]?.total ?? 1
                    const open = expandedCat === `receita:${cat}`
                    return (
                      <div key={cat}>
                      <button
                        className="w-full text-left group"
                        onClick={() => setExpandedCat(open ? null : `receita:${cat}`)}
                      >
                        <CategoryRowHeader
                          name={cat}
                          open={open}
                          detail={`${count} ${count === 1 ? 'lançamento' : 'lançamentos'}`}
                          pct={pct}
                          value={fmt(total)}
                          valueClass="text-green-600"
                        />
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${(total / maxIncome) * 100}%` }}
                          />
                        </div>
                      </button>
                      {open && renderTxList(txs)}
                      </div>
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

    </div>
  )
}
