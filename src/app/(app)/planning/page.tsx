'use client'

import { useState, useEffect } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, PiggyBank, Save, ClipboardList, Plus, X, Sparkles } from 'lucide-react'

interface PlanTemplate {
  id: string
  label: string
  description: string
  investPct: number
  reservePct: number
  color: string
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  { id: 'equilibrado',  label: 'Equilibrado',    description: '50% essenciais · 30% variáveis · 20% investimentos', investPct: 0.20, reservePct: 0.10, color: 'blue'   },
  { id: 'investidor',   label: 'Investidor',      description: '45% essenciais · 25% variáveis · 30% investimentos', investPct: 0.30, reservePct: 0.10, color: 'emerald'},
  { id: 'dividas',      label: 'Quitar Dívidas',  description: '60% essenciais · 20% variáveis · 20% quitação',      investPct: 0.05, reservePct: 0.05, color: 'amber'  },
  { id: 'personalizado',label: 'Personalizado',   description: 'Configure manualmente cada categoria',                investPct: 0,    reservePct: 0,    color: 'slate'  },
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
  const [addingCategory, setAddingCategory] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  function applyTemplate(tpl: PlanTemplate) {
    const income = parseNum(expectedIncome)
    if (income > 0 && (tpl.investPct > 0 || tpl.reservePct > 0)) {
      if (tpl.investPct > 0) setInvestmentTarget(String(Math.round(income * tpl.investPct)))
      if (tpl.reservePct > 0) setReserveTarget(String(Math.round(income * tpl.reservePct)))
    }
    setTemplateOpen(false)
  }

  const { transactions } = useTransactions({ month, year })
  const { categories } = useCategories()
  const { plan, loading, savePlan } = useBudgetPlan(month, year)

  const [expectedIncome, setExpectedIncome] = useState('')
  const [investmentTarget, setInvestmentTarget] = useState('')
  const [reserveTarget, setReserveTarget] = useState('')
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({})

  useEffect(() => {
    if (plan) {
      setExpectedIncome(plan.expected_income > 0 ? String(plan.expected_income) : '')
      setInvestmentTarget(plan.investment_target > 0 ? String(plan.investment_target) : '')
      setReserveTarget(plan.reserve_target > 0 ? String(plan.reserve_target) : '')
      const lim: Record<string, string> = {}
      for (const [cat, val] of Object.entries(plan.category_limits ?? {})) {
        lim[cat] = String(val)
      }
      setCategoryLimits(lim)
    } else {
      setExpectedIncome('')
      setInvestmentTarget('')
      setReserveTarget('')
      setCategoryLimits({})
    }
    setSaved(false)
  }, [plan, month, year])

  const expenseCategories = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')

  // Categorias já no plano (aparecem no form)
  const activeCategoryNames = Object.keys(categoryLimits)

  // Categorias disponíveis para adicionar
  const availableToAdd = expenseCategories.filter(c => !activeCategoryNames.includes(c.name))

  // Valores realizados
  const actualIncome = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const actualExpenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)

  const actualByCategory: Record<string, number> = {}
  transactions.filter(t => t.type === 'despesa').forEach(t => {
    actualByCategory[t.category] = (actualByCategory[t.category] || 0) + Number(t.amount)
  })
  // Inclui receitas também (para Investimento que pode ser saída ou entrada)
  const actualByCategoryAll: Record<string, number> = {}
  transactions.forEach(t => {
    actualByCategoryAll[t.category] = (actualByCategoryAll[t.category] || 0) + Number(t.amount)
  })

  function addCategory(name: string | null) {
    if (!name) return
    setCategoryLimits(prev => ({ ...prev, [name]: '' }))
    setAddingCategory(false)
  }

  function removeCategory(name: string) {
    setCategoryLimits(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    const limits: Record<string, number> = {}
    for (const [cat, val] of Object.entries(categoryLimits)) {
      const n = parseNum(val)
      if (n > 0) limits[cat] = n
    }
    await savePlan({
      month, year,
      expected_income: parseNum(expectedIncome),
      investment_target: parseNum(investmentTarget),
      reserve_target: parseNum(reserveTarget),
      category_limits: limits,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const incomeNum = parseNum(expectedIncome)
  const investNum = parseNum(investmentTarget)
  const reserveNum = parseNum(reserveTarget)

  // Tabela: só categorias com limite > 0
  const tableCategories = expenseCategories.filter(c => parseNum(categoryLimits[c.name] ?? '') > 0)
  const totalPlanned = tableCategories.reduce((s, c) => s + parseNum(categoryLimits[c.name] ?? ''), 0)

  // Investimento e Reserva linkados às categorias de mesmo nome
  const investActual = actualByCategoryAll['Investimento'] ?? 0
  const reserveActual =
    actualByCategory['Reserva'] ??
    actualByCategory['Reserva de emergência'] ??
    0

  const hasTable = tableCategories.length > 0 || incomeNum > 0 || investNum > 0 || reserveNum > 0

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

            {/* Receita + Investimento + Reserva */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Receita prevista
                </Label>
                <CurrencyInput value={expectedIncome} onChange={setExpectedIncome} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
                  Investimento previsto
                  <span className="text-[10px] text-blue-400">↔ cat. Investimento</span>
                </Label>
                <CurrencyInput value={investmentTarget} onChange={setInvestmentTarget} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <PiggyBank className="h-3.5 w-3.5 text-purple-500" />
                  Reserva financeira
                  <span className="text-[10px] text-purple-400">↔ cat. Reserva</span>
                </Label>
                <CurrencyInput value={reserveTarget} onChange={setReserveTarget} />
              </div>
            </div>

            {/* Limite por categoria */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Limite por categoria
                </p>
                {availableToAdd.length > 0 && !addingCategory && (
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
                      {availableToAdd.map(c => (
                        <SelectItem key={c.name} value={c.name}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                    {/* Investimento — linkado à categoria */}
                    {investNum > 0 && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Investimento</span>
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

                    {/* Reserva — linkada à categoria */}
                    {reserveNum > 0 && (
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Reserva</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300">{fmt(reserveNum)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-purple-600 dark:text-purple-400">
                          {reserveActual > 0 ? fmt(reserveActual) : <span className="text-slate-300 dark:text-slate-600">R$ 0,00</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold">
                          <span className={reserveActual >= reserveNum ? 'text-emerald-600' : 'text-amber-500'}>
                            {reserveActual - reserveNum > 0 ? '+' : ''}{fmt(reserveActual - reserveNum)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge planned={reserveNum} actual={reserveActual} higherIsBetter />
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
