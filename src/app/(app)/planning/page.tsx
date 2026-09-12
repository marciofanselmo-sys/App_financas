'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { sumInvestmentContributions } from '@/lib/investment-contributions'
import { useCategories } from '@/hooks/use-categories'
import { useSubcategories } from '@/hooks/use-subcategories'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useRecurringMonthlyTotal } from '@/hooks/use-recurring-monthly-total'
import { categoriesForDate } from '@/lib/special-category-filter'
import { subKey, isSubKey, subName } from '@/lib/plan-keys'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, PiggyBank, Save, ClipboardList, Plus, X, Sparkles, RefreshCw, Tag } from 'lucide-react'

interface PlanTemplate {
  id: string
  label: string
  description: string
  investPct: number
  color: string
}

// Reserva não é mais um alvo separado (2026-07-09) — já é coberta pelo
// Investimento previsto, então o percentual que cada template reservava pra
// ela entrou direto no investPct, pra manter a intenção original do template
// (ex: "Equilibrado" ainda separa 30% da renda pra investir+reservar, só que
// tudo dentro de um único campo agora).
const PLAN_TEMPLATES: PlanTemplate[] = [
  { id: 'equilibrado',  label: 'Equilibrado',    description: '50% essenciais · 30% variáveis · 20% investimentos', investPct: 0.30, color: 'blue'   },
  { id: 'investidor',   label: 'Investidor',      description: '45% essenciais · 25% variáveis · 30% investimentos', investPct: 0.40, color: 'emerald'},
  { id: 'dividas',      label: 'Quitar Dívidas',  description: '60% essenciais · 20% variáveis · 20% quitação',      investPct: 0.10, color: 'amber'  },
  { id: 'personalizado',label: 'Personalizado',   description: 'Configure manualmente cada categoria',                investPct: 0,    color: 'slate'  },
]

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// Exibe valor formatado em repouso, number input ao editar
function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [editing, setEditing] = useState(false)

  const num = parseFloat(value.replace(',', '.'))
  const formatted =
    !isNaN(num) && num > 0
      ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
      : ''

  if (editing) {
    return (
      <Input
        type="number"
        autoFocus
        defaultValue={!isNaN(num) && num > 0 ? num : ''}
        onChange={e => onChange(e.target.value)}
        onBlur={e => { onChange(e.target.value); setEditing(false) }}
        step="0.01"
        min="0"
        placeholder={placeholder}
        className={className}
      />
    )
  }

  return (
    <Input
      type="text"
      value={formatted}
      placeholder={placeholder}
      readOnly
      onFocus={() => setEditing(true)}
      onClick={() => setEditing(true)}
      className={`cursor-pointer ${className}`}
    />
  )
}

function StatusBadge({ planned, actual, higherIsBetter = false }: { planned: number; actual: number; higherIsBetter?: boolean }) {
  if (planned === 0) return null
  const pct = (actual / planned) * 100
  if (higherIsBetter) {
    if (pct >= 100) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle className="h-3 w-3" /> Atingido</span>
    if (pct >= 80)  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500"><AlertTriangle className="h-3 w-3" /> Quase</span>
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500"><XCircle className="h-3 w-3" /> Abaixo</span>
  }
  if (pct <= 90)  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle className="h-3 w-3" /> OK</span>
  if (pct <= 100) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500"><AlertTriangle className="h-3 w-3" /> Atenção</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500"><XCircle className="h-3 w-3" /> Estourado</span>
}

function parseNum(v: string) {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) || n <= 0 ? 0 : n
}

export default function PlanningPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingSubcategory, setAddingSubcategory] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  function applyTemplate(tpl: PlanTemplate) {
    const income = parseNum(expectedIncome)
    if (income > 0 && tpl.investPct > 0) {
      setInvestmentTarget(String(Math.round(income * tpl.investPct)))
    }
    setTemplateOpen(false)
  }

  const { transactions } = useTransactions({ month, year })
  const { boards } = useTransactionBoards()
  const { categories } = useCategories()
  const { subcategories } = useSubcategories()
  const { plan, loading, savePlan } = useBudgetPlan(month, year)
  const { total: recurringMonthlyTotal, loading: recurringLoading } = useRecurringMonthlyTotal()

  // "Gastos Previstos" trava (snapshot) no valor do momento do save — não
  // recalcula sozinho depois. Antes do primeiro save do mês, mostra uma
  // prévia ao vivo do total de recorrências confirmadas + parcelas ativas.
  const hasExpensesSnapshot = !!plan && plan.expenses_target > 0
  const expensesTargetDisplay = hasExpensesSnapshot ? plan!.expenses_target : recurringMonthlyTotal

  const [expectedIncome, setExpectedIncome] = useState('')
  const [investmentTarget, setInvestmentTarget] = useState('')
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({})

  useEffect(() => {
    if (plan) {
      setExpectedIncome(plan.expected_income > 0 ? String(plan.expected_income) : '')
      setInvestmentTarget(plan.investment_target > 0 ? String(plan.investment_target) : '')
      const lim: Record<string, string> = {}
      for (const [cat, val] of Object.entries(plan.category_limits ?? {})) {
        lim[cat] = String(val)
      }
      setCategoryLimits(lim)
    } else {
      setExpectedIncome('')
      setInvestmentTarget('')
      setCategoryLimits({})
    }
    setSaved(false)
  }, [plan, month, year])

  // Categoria especial só entra na lista se for válida no mês/ano do plano
  // sendo editado — mesmo filtro usado no resto do app pra seleção de categoria.
  const planDateStr = `${year}-${String(month).padStart(2, '0')}-01`
  const expenseCategories = categoriesForDate(categories, planDateStr).filter(c => c.type === 'despesa' || c.type === 'ambos')

  // Categorias e subcategorias já no plano (aparecem no form) — subcategorias
  // ficam misturadas no mesmo mapa com a chave "sub:Nome".
  const activeKeys = Object.keys(categoryLimits)
  const activeCategoryNames = activeKeys.filter(k => !isSubKey(k))
  const activeSubcategoryNames = activeKeys.filter(isSubKey).map(subName)

  // Categorias já cobertas por uma subcategoria ativa no plano — uma
  // categoria vinculada a uma subcategoria conta as mesmas transações
  // (group_label) que a categoria conta sozinha (category), então oferecer
  // as duas ao mesmo tempo duplicaria o "Realizado" na tabela Planejado ×
  // Realizado pra um único gasto real.
  const categoriesCoveredByActiveSubcategories = new Set(
    subcategories
      .filter(s => activeSubcategoryNames.includes(s.name))
      .flatMap(s => s.categories ?? [])
  )

  // Categorias disponíveis para adicionar — normais e isoladas em seletores
  // separados, mesmo padrão do resto do app.
  const availableToAddAll = expenseCategories.filter(c =>
    !activeCategoryNames.includes(c.name) && !categoriesCoveredByActiveSubcategories.has(c.name)
  )
  const availableToAddNormal = availableToAddAll.filter(c => !c.special_dates || c.special_dates.length === 0)
  const availableToAddSpecial = availableToAddAll.filter(c => (c.special_dates?.length ?? 0) > 0)

  // Subcategorias disponíveis — só as de tipo despesa (planejamento só cobre gastos)
  const availableSubcategories = subcategories.filter(s => s.type === 'despesa' && !activeSubcategoryNames.includes(s.name))

  // Valores realizados
  const actualIncome = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)

  const actualByCategory: Record<string, number> = {}
  transactions.filter(t => t.type === 'despesa').forEach(t => {
    actualByCategory[t.category] = (actualByCategory[t.category] || 0) + Number(t.amount)
  })
  // Inclui receitas também (para Investimento que pode ser saída ou entrada)
  const actualByCategoryAll: Record<string, number> = {}
  transactions.forEach(t => {
    actualByCategoryAll[t.category] = (actualByCategoryAll[t.category] || 0) + Number(t.amount)
  })
  // Realizado por subcategoria — soma por group_label, independente da categoria
  const actualByGroupLabel: Record<string, number> = {}
  transactions.filter(t => t.type === 'despesa' && t.group_label).forEach(t => {
    const label = t.group_label as string
    actualByGroupLabel[label] = (actualByGroupLabel[label] || 0) + Number(t.amount)
  })

  function addCategory(name: string | null) {
    if (!name) return
    setCategoryLimits(prev => ({ ...prev, [name]: '' }))
    setAddingCategory(false)
  }

  function addSubcategory(name: string | null) {
    if (!name) return
    setCategoryLimits(prev => ({ ...prev, [subKey(name)]: '' }))
    setAddingSubcategory(false)
  }

  function removeCategory(name: string) {
    setCategoryLimits(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  function removeSubcategory(name: string) {
    removeCategory(subKey(name))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const limits: Record<string, number> = {}
    for (const [cat, val] of Object.entries(categoryLimits)) {
      const n = parseNum(val)
      if (n > 0) limits[cat] = n
    }
    const { error } = await savePlan({
      month, year,
      expected_income: parseNum(expectedIncome),
      expenses_target: expensesTargetDisplay,
      investment_target: parseNum(investmentTarget),
      // Reserva removida da UI (2026-07-09): já é coberta pelo Investimento
      // previsto, não faz sentido ter um alvo manual separado. Mantém a
      // coluna gravando 0 pra não precisar migrar o schema/hook.
      reserve_target: 0,
      category_limits: limits,
    })
    setSaving(false)
    // Antes disso, o "Salvo com sucesso!" aparecia mesmo quando o save falhava
    // (ex: tabela budget_plans ausente num Supabase novo) — o erro do Supabase
    // era descartado em silêncio e a tela dava falso positivo.
    if (error) {
      setSaveError(typeof error === 'string' ? error : (error as { message?: string })?.message || 'Erro ao salvar o planejamento.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const incomeNum = parseNum(expectedIncome)
  const investNum = parseNum(investmentTarget)

  // Tabela: só categorias/subcategorias com limite > 0
  const tableCategories = expenseCategories.filter(c => parseNum(categoryLimits[c.name] ?? '') > 0)
  const tableSubcategories = subcategories.filter(s => s.type === 'despesa' && parseNum(categoryLimits[subKey(s.name)] ?? '') > 0)

  // Total Despesas soma categoria + subcategoria — uma categoria não pode mais
  // ser adicionada em "Limite por categoria" se já pertence a uma subcategoria
  // ativa neste plano (ver availableToAddAll acima), então as duas listas
  // nunca se sobrepõem: cada despesa planejada aparece numa delas, nunca nas
  // duas ao mesmo tempo. Antes disso, o total só somava categoria — um plano
  // feito inteiramente por subcategoria (comum: cobre o mesmo gasto com um
  // recorte mais fino) aparecia com "Total Despesas" vazio.
  const totalPlanned =
    tableCategories.reduce((s, c) => s + parseNum(categoryLimits[c.name] ?? ''), 0) +
    tableSubcategories.reduce((s, sub) => s + parseNum(categoryLimits[subKey(sub.name)] ?? ''), 0)

  // Realizado do Total Despesas soma só as mesmas linhas que aparecem na
  // tabela acima (categorias/subcategorias com limite > 0), não o gasto total
  // do período — senão a linha "Total Despesas" não batia com a soma visível
  // das linhas mostradas (categoria fora do plano empurrava o total pra cima
  // sem aparecer em lugar nenhum da tabela, parecendo conta errada).
  const actualExpenses =
    tableCategories.reduce((s, c) => s + (actualByCategory[c.name] ?? 0), 0) +
    tableSubcategories.reduce((s, sub) => s + (actualByGroupLabel[sub.name] ?? 0), 0)

  // Gasto real do período inteiro, rastreado ou não no plano — só contexto,
  // nunca comparado direto contra totalPlanned (isso quebraria de novo o
  // "Total Despesas" bater com a soma das linhas da tabela). Mostrado como
  // nota abaixo da tabela quando existe gasto fora do que foi planejado, pra
  // não parecer que o app "esqueceu" parte das despesas.
  const totalDespesasPeriodo = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  const untrackedExpenses = Math.max(0, totalDespesasPeriodo - actualExpenses)

  // Investimento linkado à categoria de mesmo nome
  const investActual = useMemo(
    () => sumInvestmentContributions(transactions, boards),
    [transactions, boards],
  )

  const hasTable = tableCategories.length > 0 || tableSubcategories.length > 0 || incomeNum > 0 || investNum > 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Planejamento Mensal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Defina metas e acompanhe Planejado × Realizado</p>
        </div>
        <PeriodFilter month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <>
          {/* Formulário */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-500" />
                Configure seu planejamento
              </h2>
              <button
                type="button"
                onClick={() => setTemplateOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Usar template
              </button>
            </div>

            {/* Template picker */}
            {templateOpen && (
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                {PLAN_TEMPLATES.map(tpl => {
                  const colorMap: Record<string, string> = {
                    blue: 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-500/10',
                    emerald: 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10',
                    amber: 'border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10',
                    slate: 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50',
                  }
                  const textMap: Record<string, string> = {
                    blue: 'text-blue-700 dark:text-blue-300',
                    emerald: 'text-emerald-700 dark:text-emerald-300',
                    amber: 'text-amber-700 dark:text-amber-300',
                    slate: 'text-slate-700 dark:text-slate-200',
                  }
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${colorMap[tpl.color]}`}
                    >
                      <span className={`text-sm font-bold ${textMap[tpl.color]}`}>{tpl.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{tpl.description}</span>
                    </button>
                  )
                })}
                {parseNum(expectedIncome) === 0 && (
                  <p className="col-span-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Preencha a receita prevista para aplicar valores automaticamente.
                  </p>
                )}
              </div>
            )}

            {/* Receita + Gastos Previstos + Investimento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Receita prevista
                </Label>
                <CurrencyInput value={expectedIncome} onChange={setExpectedIncome} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                  <RefreshCw className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                  Gastos Previstos
                  <span className="text-[10px] text-slate-400">{hasExpensesSnapshot ? '(recorrência)' : '(prévia)'}</span>
                </Label>
                <Input
                  type="text"
                  readOnly
                  value={recurringLoading ? '...' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(expensesTargetDisplay)}
                  className="bg-slate-50 dark:bg-slate-700/50 cursor-default text-slate-500 dark:text-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                  <PiggyBank className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Investimento previsto
                  <span className="text-[10px] text-blue-400">↔ cat. Investimento</span>
                </Label>
                <CurrencyInput value={investmentTarget} onChange={setInvestmentTarget} />
              </div>
            </div>

            {/* Limite por categoria + por subcategoria — lado a lado a partir de md */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">

            {/* Limite por categoria */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Limite por categoria
                </p>
                {availableToAddAll.length > 0 && !addingCategory && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    onClick={() => setAddingCategory(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                )}
              </div>

              {/* Seletor de categoria */}
              {addingCategory && (
                <div className="flex items-center gap-2">
                  <Select onValueChange={addCategory}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Selecione uma categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAddNormal.length === 0 ? (
                        <SelectItem value="__empty__" disabled>Nenhuma categoria disponível</SelectItem>
                      ) : (
                        availableToAddNormal.map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableToAddSpecial.length > 0 && (
                    <Select onValueChange={addCategory}>
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue placeholder="Categoria isolada..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableToAddSpecial.map(c => (
                          <SelectItem key={c.name} value={c.name}>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-slate-400 hover:text-slate-600" onClick={() => setAddingCategory(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Lista de categorias adicionadas */}
              {activeCategoryNames.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                  Nenhuma categoria adicionada. Clique em &ldquo;Adicionar&rdquo; acima.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeCategoryNames.map(name => {
                    const cat = expenseCategories.find(c => c.name === name)
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? '#6b7280' }} />
                          <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{name}</span>
                        </div>
                        <CurrencyInput
                          value={categoryLimits[name] ?? ''}
                          onChange={v => setCategoryLimits(prev => ({ ...prev, [name]: v }))}
                          placeholder="0,00"
                          className="h-9 w-44 text-sm"
                        />
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => removeCategory(name)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Limite por subcategoria (recorrência) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Limite por subcategoria
                </p>
                {availableSubcategories.length > 0 && !addingSubcategory && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 text-xs gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    onClick={() => setAddingSubcategory(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </Button>
                )}
              </div>

              {addingSubcategory && (
                <div className="flex items-center gap-2">
                  <Select onValueChange={addSubcategory}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Selecione uma subcategoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubcategories.length === 0 ? (
                        <SelectItem value="__empty__" disabled>Nenhuma subcategoria disponível</SelectItem>
                      ) : (
                        availableSubcategories.map(s => (
                          <SelectItem key={s.name} value={s.name}>
                            <div className="flex items-center gap-2">
                              <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-slate-400 hover:text-slate-600" onClick={() => setAddingSubcategory(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {activeSubcategoryNames.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2">
                  Nenhuma subcategoria adicionada.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeSubcategoryNames.map(name => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{name}</span>
                      </div>
                      <CurrencyInput
                        value={categoryLimits[subKey(name)] ?? ''}
                        onChange={v => setCategoryLimits(prev => ({ ...prev, [subKey(name)]: v }))}
                        placeholder="0,00"
                        className="h-9 w-44 text-sm"
                      />
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => removeSubcategory(name)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            </div>

            {/* Salvar */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Planejamento'}
              </Button>
              {saved && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Salvo com sucesso!
                </span>
              )}
              {saveError && (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 shrink-0" /> Não foi possível salvar: {saveError}
                </span>
              )}
            </div>
          </div>

          {/* Planejado × Realizado */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Planejado × Realizado</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Comparativo do período selecionado</p>
            </div>

            {!hasTable ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Configure seu planejamento acima e salve para ver o comparativo aqui.
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-6 py-3">Item</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-4 py-3">Planejado</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-4 py-3">Realizado</th>
                      <th className="text-right text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-4 py-3">Diferença</th>
                      <th className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">

                    {/* Receita */}
                    {incomeNum > 0 && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Receita</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">{fmt(incomeNum)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmt(actualIncome)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          <span className={actualIncome >= incomeNum ? 'text-emerald-600' : 'text-red-500'}>
                            {actualIncome >= incomeNum ? '+' : ''}{fmt(actualIncome - incomeNum)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge planned={incomeNum} actual={actualIncome} higherIsBetter />
                        </td>
                      </tr>
                    )}

                    {/* Categorias de despesa */}
                    {tableCategories.map(cat => {
                      const planned = parseNum(categoryLimits[cat.name] ?? '')
                      const actual = actualByCategory[cat.name] ?? 0
                      const diff = actual - planned
                      return (
                        <tr key={cat.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-xs text-slate-600 dark:text-slate-300">{cat.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">{fmt(planned)}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">
                            {actual > 0 ? fmt(actual) : <span className="text-slate-300 dark:text-slate-600">R$ 0,00</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            <span className={diff <= 0 ? 'text-emerald-600' : 'text-red-500'}>
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge planned={planned} actual={actual} />
                          </td>
                        </tr>
                      )
                    })}

                    {/* Subcategorias — entram no Total Despesas junto com as
                        categorias (nunca junto com a categoria que já pertence
                        a elas, ver comentário de totalPlanned acima) */}
                    {tableSubcategories.map(sub => {
                      const planned = parseNum(categoryLimits[subKey(sub.name)] ?? '')
                      const actual = actualByGroupLabel[sub.name] ?? 0
                      const diff = actual - planned
                      return (
                        <tr key={`sub:${sub.name}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-600 dark:text-slate-300">{sub.name}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">subcategoria</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">{fmt(planned)}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-red-500">
                            {actual > 0 ? fmt(actual) : <span className="text-slate-300 dark:text-slate-600">R$ 0,00</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-semibold">
                            <span className={diff <= 0 ? 'text-emerald-600' : 'text-red-500'}>
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge planned={planned} actual={actual} />
                          </td>
                        </tr>
                      )
                    })}

                    {/* Investimento — linkado à categoria */}
                    {investNum > 0 && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Investir (aportes)</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">{fmt(investNum)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {investActual > 0 ? fmt(investActual) : <span className="text-slate-300 dark:text-slate-600">R$ 0,00</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          <span className={investActual >= investNum ? 'text-emerald-600' : 'text-amber-500'}>
                            {investActual - investNum > 0 ? '+' : ''}{fmt(investActual - investNum)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge planned={investNum} actual={investActual} higherIsBetter />
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {(totalPlanned > 0 || actualExpenses > 0) && (
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-700/30 border-t-2 border-slate-200 dark:border-slate-600">
                        <td className="px-6 py-3">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Total Despesas</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-200">
                          {totalPlanned > 0 ? fmt(totalPlanned) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{fmt(actualExpenses)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          {totalPlanned > 0 && (
                            <span className={actualExpenses <= totalPlanned ? 'text-emerald-600' : 'text-red-500'}>
                              {actualExpenses <= totalPlanned ? '' : '+'}{fmt(actualExpenses - totalPlanned)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {totalPlanned > 0 && <StatusBadge planned={totalPlanned} actual={actualExpenses} />}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {untrackedExpenses > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                  + {fmt(untrackedExpenses)} em despesas fora deste plano (categorias/subcategorias sem limite definido) — não entram no &ldquo;Total Despesas&rdquo; acima. Gasto real do período: {fmt(totalDespesasPeriodo)}.
                </p>
              )}
              </>
            )}
          </div>

          {/* Resumo de desvio */}
          {hasTable && totalPlanned > 0 && (
            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
              actualExpenses <= totalPlanned
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
            }`}>
              {actualExpenses <= totalPlanned
                ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              }
              <div className="flex-1 min-w-0">
                {actualExpenses <= totalPlanned ? (
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Você está {fmt(totalPlanned - actualExpenses)} dentro do planejamento este mês.
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Você está {fmt(actualExpenses - totalPlanned)} acima do planejamento este mês.
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Planejado: {fmt(totalPlanned)} · Realizado: {fmt(actualExpenses)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
