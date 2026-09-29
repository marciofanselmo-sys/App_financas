'use client'

import { withPlan } from '@/components/plan/with-plan'

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { sumInvestmentContributions } from '@/lib/investment-contributions'
import { useCategories } from '@/hooks/use-categories'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { realMovements, internalTotals } from '@/lib/internal-movement'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { useRecurring } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { useSubcategoryNames } from '@/hooks/use-subcategory-names'
import { buildDisplayItems } from '@/lib/recurring-groups'
import { cn } from '@/lib/utils'
import { Transaction } from '@/types'
import { categoriesForDate } from '@/lib/special-category-filter'
import { subKey, isSubKey, subName } from '@/lib/plan-keys'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, PiggyBank, ClipboardList, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'

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

  // Só avisa quando o número mudou de verdade — clicar e sair sem alterar
  // nada não pode disparar o salvamento automático.
  const commit = (v: string) => {
    if (parseNum(v) !== parseNum(value)) onChange(v)
  }

  // `key` diferente nos dois modos: sem isso o React reaproveita a mesma caixa,
  // o texto formatado ("1.420,00") não é número válido para type="number" e a
  // caixa abria vazia — ao sair, o vazio era gravado como zero.
  if (editing) {
    return (
      <Input
        key="edit"
        type="number"
        autoFocus
        defaultValue={!isNaN(num) && num > 0 ? num : ''}
        onChange={e => commit(e.target.value)}
        onBlur={e => { commit(e.target.value); setEditing(false) }}
        step="0.01"
        min="0"
        placeholder={placeholder}
        className={className}
      />
    )
  }

  return (
    <Input
      key="view"
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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function SaveIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'saving') return <span className="text-xs text-slate-400">Salvando...</span>
  if (status === 'saved') return (
    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
      <CheckCircle className="h-3.5 w-3.5" /> Salvo
    </span>
  )
  if (status === 'error') return (
    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1" title={error ?? undefined}>
      <XCircle className="h-3.5 w-3.5 shrink-0" /> Não foi possível salvar
    </span>
  )
  return null
}

function parseNum(v: string) {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) || n <= 0 ? 0 : n
}

// Mês anterior a (month, year), n vezes para trás.
function monthsBack(month: number, year: number, n: number) {
  const d = new Date(year, month - 1 - n, 1)
  return { month: d.getMonth() + 1, year: d.getFullYear() }
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

// Linha da tabela Planejado × Realizado. Em despesa, gastar menos é bom;
// em receita e investimento (higherIsBetter), é o contrário.
function TableRow({ label, planned, actual, actualClass, higherIsBetter = false, strong = false, sub = false }: {
  label: string; planned: number; actual: number; actualClass: string
  higherIsBetter?: boolean; strong?: boolean; sub?: boolean
}) {
  const diff = actual - planned
  const good = higherIsBetter ? diff >= 0 : diff <= 0
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <td className={cn('py-3 pr-4', sub ? 'pl-10' : 'pl-6')}>
        <span className={cn('text-xs', strong ? 'font-semibold text-slate-700 dark:text-slate-200' : sub ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-300')}>
          {label}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">{fmt(planned)}</td>
      <td className={cn('px-4 py-3 text-right text-xs font-semibold tabular-nums', actual > 0 ? actualClass : 'text-slate-300 dark:text-slate-600')}>
        {fmt(actual)}
      </td>
      <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums">
        <span className={good ? 'text-emerald-600' : 'text-red-500'}>{diff > 0 ? '+' : ''}{fmt(diff)}</span>
      </td>
      <td className="px-4 py-3 text-center"><StatusBadge planned={planned} actual={actual} higherIsBetter={higherIsBetter} /></td>
    </tr>
  )
}

// Celular: a tabela de 5 colunas não cabe, então cada item vira duas linhas —
// realizado de planejado em cima, barra e diferença embaixo.
function MobileRow({ label, planned, actual, actualClass, higherIsBetter = false, strong = false, sub = false }: {
  label: string; planned: number; actual: number; actualClass: string
  higherIsBetter?: boolean; strong?: boolean; sub?: boolean
}) {
  const diff = actual - planned
  const pct = planned > 0 ? (actual / planned) * 100 : 0
  const bar = higherIsBetter
    ? (pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-red-500')
    : (pct > 100 ? 'bg-red-500' : pct > 90 ? 'bg-amber-500' : 'bg-emerald-500')
  const text = higherIsBetter
    ? (diff >= 0 ? { t: `Atingido${diff > 0 ? ` · +${fmt(diff)}` : ''}`, c: 'text-emerald-600 dark:text-emerald-400' }
                 : { t: `Faltam ${fmt(-diff)}`, c: pct >= 80 ? 'text-amber-500' : 'text-red-500' })
    : (diff <= 0 ? { t: `Sobram ${fmt(-diff)}`, c: pct > 90 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400' }
                 : { t: `Passou ${fmt(diff)}`, c: 'text-red-500' })
  return (
    <div className={cn('py-3 pr-4', sub ? 'pl-9' : 'pl-5')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('text-sm truncate', strong ? 'font-semibold text-slate-700 dark:text-slate-200' : sub ? 'text-xs text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-300')}>
          {label}
        </span>
        <span className="text-xs tabular-nums whitespace-nowrap shrink-0">
          <span className={cn('font-semibold', actual > 0 ? actualClass : 'text-slate-400')}>{fmt(actual)}</span>
          <span className="text-slate-400 dark:text-slate-500"> de {fmt(planned)}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className={cn('text-[11px] font-semibold tabular-nums whitespace-nowrap', text.c)}>{text.t}</span>
      </div>
    </div>
  )
}

function PlanningPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  // Orçamento do mês recolhível; a escolha fica lembrada neste navegador.
  const [budgetOpen, setBudgetOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem('nobli:planning-budget-open') === '0') setBudgetOpen(false) } catch {}
  }, [])
  function toggleBudget() {
    setBudgetOpen(v => {
      try { localStorage.setItem('nobli:planning-budget-open', v ? '0' : '1') } catch {}
      return !v
    })
  }
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showQuiet, setShowQuiet] = useState(false)

  const { boards } = useTransactionBoards()
  // "Realizado" precisa da mesma exclusão do dashboard: conta desafixada e
  // conta de investimento não entram no gasto do mês. Sem isso, o Planejamento
  // comparava o planejado contra um realizado que incluía a conta da loja e os
  // aportes — estourando o plano sem o usuário ter gasto nada a mais. (14.15)
  const excludedBoardIds = useMemo(
    () => boards.filter(b => !b.show_on_dashboard || b.is_investment).map(b => b.id),
    [boards],
  )
  const exclude = excludedBoardIds.length > 0 ? excludedBoardIds : undefined
  const { transactions } = useTransactions({ month, year, exclude_board_ids: exclude })

  // Os três meses anteriores, para a média de cada categoria.
  const p1 = monthsBack(month, year, 1)
  const p2 = monthsBack(month, year, 2)
  const p3 = monthsBack(month, year, 3)
  const { transactions: prev1 } = useTransactions({ ...p1, exclude_board_ids: exclude })
  const { transactions: prev2 } = useTransactions({ ...p2, exclude_board_ids: exclude })
  const { transactions: prev3 } = useTransactions({ ...p3, exclude_board_ids: exclude })

  const { categories } = useCategories()
  const motherNames = useMemo(() => motherNameByCategory(categories), [categories])

  const { plan, loading, loadedKey, savePlan } = useBudgetPlan(month, year)

  // Fixos (Recorrências confirmadas + parcelas ativas), por categoria — o
  // mesmo cálculo de useRecurringMonthlyTotal, mas guardando onde cada um cai.
  const { recurring, installments, loading: recurringLoading } = useRecurring()
  const { decisions, loading: decisionsLoading } = useRecurringDecisions()
  const subcategoryNames = useSubcategoryNames()
  const fixed = useMemo(() => {
    const byCategory: Record<string, number> = {}
    const byMother: Record<string, number> = {}
    let total = 0
    const add = (category: string, amount: number) => {
      byCategory[category] = (byCategory[category] ?? 0) + amount
      const mother = motherOf(category, motherNames, 'despesa')
      byMother[mother] = (byMother[mother] ?? 0) + amount
      total += amount
    }
    for (const item of buildDisplayItems(recurring, new Map(), subcategoryNames)) {
      if (item.type === 'despesa' && decisions.get(item.key) === 'confirmed') add(item.category, item.avgAmount)
    }
    for (const inst of installments) add(inst.category, inst.monthlyAmount)
    return { byCategory, byMother, total }
  }, [recurring, installments, decisions, subcategoryNames, motherNames])

  // "Gastos Previstos" trava (snapshot) no valor do momento do primeiro save
  // do mês — não recalcula sozinho depois. Antes disso, é o total ao vivo.
  const hasExpensesSnapshot = !!plan && plan.expenses_target > 0
  const expensesTargetDisplay = hasExpensesSnapshot ? plan!.expenses_target : fixed.total

  const [expectedIncome, setExpectedIncome] = useState('')
  const [investmentTarget, setInvestmentTarget] = useState('')
  const [categoryLimits, setCategoryLimits] = useState<Record<string, string>>({})

  // ── Salvamento automático ────────────────────────────────────────────────
  // Só o que o usuário digitou marca "sujo" — carregar o mês (ou herdar o
  // plano do mês anterior) não grava nada sozinho.
  const dirty = useRef(false)
  const latest = useRef({ month, year, expectedIncome, investmentTarget, categoryLimits, expensesTargetDisplay })

  async function saveNow() {
    if (!dirty.current) return
    dirty.current = false
    const s = latest.current
    const limits: Record<string, number> = {}
    for (const [cat, val] of Object.entries(s.categoryLimits)) {
      const n = parseNum(val)
      if (n > 0) limits[cat] = n
    }
    setSaveStatus('saving')
    setSaveError(null)
    const { error } = await savePlan({
      month: s.month, year: s.year,
      expected_income: parseNum(s.expectedIncome),
      expenses_target: s.expensesTargetDisplay,
      investment_target: parseNum(s.investmentTarget),
      // Reserva removida da UI (2026-07-09): já é coberta pelo Investimento.
      reserve_target: 0,
      category_limits: limits,
    })
    if (error) {
      setSaveStatus('error')
      setSaveError(typeof error === 'string' ? error : (error as { message?: string })?.message || 'Erro ao salvar o planejamento.')
      return
    }
    setSaveStatus('saved')
  }
  const saveRef = useRef(saveNow)
  // Refs atualizados depois de cada render: o save lê sempre o último valor.
  useEffect(() => {
    latest.current = { month, year, expectedIncome, investmentTarget, categoryLimits, expensesTargetDisplay }
    saveRef.current = saveNow
  })

  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => saveRef.current(), 1200)
    return () => clearTimeout(t)
  }, [expectedIncome, investmentTarget, categoryLimits])

  // Saiu da tela com algo pendente: grava antes de ir.
  useEffect(() => () => { saveRef.current() }, [])

  function edit<T>(setter: (fn: (prev: T) => T) => void) {
    return (fn: (prev: T) => T) => {
      dirty.current = true
      setSaveStatus('idle')
      setter(fn)
    }
  }
  const editLimits = edit<Record<string, string>>(setCategoryLimits)
  const setLimit = (key: string, v: string) => editLimits(prev => ({ ...prev, [key]: v }))
  const editIncome = (v: string) => { dirty.current = true; setSaveStatus('idle'); setExpectedIncome(v) }
  const editInvest = (v: string) => { dirty.current = true; setSaveStatus('idle'); setInvestmentTarget(v) }

  // Trocar de mês grava o que ficou pendente no mês que está sendo deixado.
  function changeMonth(m: number) { saveRef.current(); setMonth(m) }
  function changeYear(y: number) { saveRef.current(); setYear(y) }

  function applyTemplate(tpl: PlanTemplate) {
    const income = parseNum(expectedIncome)
    if (income > 0 && tpl.investPct > 0) editInvest(String(Math.round(income * tpl.investPct)))
    setTemplateOpen(false)
  }

  // Planos salvos antes da conversão guardam "sub:Moradia" — e Moradia virou
  // categoria PRINCIPAL. Reescreve a chave; chave sem categoria é descartada.
  useEffect(() => {
    if (categories.length === 0) return
    setCategoryLimits(prev => {
      const next: Record<string, string> = {}
      let changed = false
      for (const [key, value] of Object.entries(prev)) {
        const name = isSubKey(key) ? subName(key) : key
        const cat = categories.find(c => c.name === name)
        if (!cat) { changed = true; continue }
        const fixedKey = cat.parent_id ? subKey(name) : name
        if (fixedKey !== key) changed = true
        next[fixedKey] = value
      }
      return changed ? next : prev
    })
  }, [categories])

  // Carrega o plano uma vez por mês. Depois do save automático o hook devolve
  // o plano salvo, mas recarregar o formulário ali apagaria o que a pessoa
  // continua digitando — por isso a chave do mês.
  const hydratedFor = useRef<string | null>(null)
  useEffect(() => {
    const k = `${year}-${month}`
    if (loading || loadedKey !== k) return
    if (hydratedFor.current === k) return
    hydratedFor.current = k
    dirty.current = false
    setSaveStatus('idle')
    setExpectedIncome(plan && plan.expected_income > 0 ? String(plan.expected_income) : '')
    setInvestmentTarget(plan && plan.investment_target > 0 ? String(plan.investment_target) : '')
    const lim: Record<string, string> = {}
    for (const [cat, val] of Object.entries(plan?.category_limits ?? {})) lim[cat] = String(val)
    setCategoryLimits(lim)
  }, [plan, loading, loadedKey, month, year])

  // ── Árvore de categorias de despesa ──────────────────────────────────────
  const planDateStr = `${year}-${String(month).padStart(2, '0')}-01`
  const usable = categoriesForDate(categories, planDateStr).filter(c => c.type === 'despesa' || c.type === 'ambos')
  const mothers = usable.filter(c => !c.parent_id)
  const kidsOf = (id: string) => usable.filter(c => c.parent_id === id)

  // Movimentação entre contas do próprio usuário não é gasto nem ganho.
  const realTransactions = realMovements(transactions)
  const internal = internalTotals(transactions)
  const actualIncome = realTransactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)

  function sumDespesa(txs: Transaction[]) {
    const byCategory: Record<string, number> = {}
    const byMother: Record<string, number> = {}
    let total = 0
    for (const t of txs) {
      if (t.type !== 'despesa') continue
      const amt = Number(t.amount)
      byCategory[t.category] = (byCategory[t.category] ?? 0) + amt
      const mother = motherOf(t.category, motherNames, t.type)
      byMother[mother] = (byMother[mother] ?? 0) + amt
      total += amt
    }
    return { byCategory, byMother, total }
  }
  const actual = sumDespesa(realTransactions)

  // Média dos meses anteriores que têm algum gasto — mês ainda sem extrato
  // importado não puxa a média para baixo.
  const average = useMemo(() => {
    const months = [prev1, prev2, prev3].map(realMovements).map(sumDespesa).filter(m => m.total > 0)
    const byCategory: Record<string, number> = {}
    const byMother: Record<string, number> = {}
    for (const m of months) {
      for (const [k, v] of Object.entries(m.byCategory)) byCategory[k] = (byCategory[k] ?? 0) + v / months.length
      for (const [k, v] of Object.entries(m.byMother)) byMother[k] = (byMother[k] ?? 0) + v / months.length
    }
    return { byCategory, byMother, months: months.length }
  }, [prev1, prev2, prev3, motherNames]) // eslint-disable-line react-hooks/exhaustive-deps

  // Limite efetivo da categoria: o dela, ou a soma das subcategorias quando
  // só elas têm limite. Nunca soma os dois — contaria o mesmo gasto duas vezes.
  const rows = mothers.map(m => {
    const kids = kidsOf(m.id)
    const own = parseNum(categoryLimits[m.name] ?? '')
    const kidsSum = kids.reduce((s, k) => s + parseNum(categoryLimits[subKey(k.name)] ?? ''), 0)
    return {
      cat: m,
      kids,
      own,
      kidsSum,
      planned: own > 0 ? own : kidsSum,
      actual: actual.byMother[m.name] ?? 0,
      avg: average.byMother[m.name] ?? 0,
      fixed: fixed.byMother[m.name] ?? 0,
    }
  })
  const isActive = (r: typeof rows[number]) => r.planned > 0 || r.actual > 0 || r.avg > 0 || r.fixed > 0
  const activeRows = rows.filter(isActive)
    .sort((a, b) => Math.max(b.planned, b.avg, b.actual) - Math.max(a.planned, a.avg, a.actual))
  const quietRows = rows.filter(r => !isActive(r)).sort((a, b) => a.cat.name.localeCompare(b.cat.name, 'pt-BR'))

  const incomeNum = parseNum(expectedIncome)
  const investNum = parseNum(investmentTarget)
  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0)
  const free = incomeNum - investNum - totalPlanned
  // Realizado só das categorias com limite, para bater com o planejado.
  const actualPlanned = rows.filter(r => r.planned > 0).reduce((s, r) => s + r.actual, 0)
  const untracked = Math.max(0, actual.total - actualPlanned)
  const tableRows = activeRows.filter(r => r.planned > 0)
  const hasTable = tableRows.length > 0 || incomeNum > 0 || investNum > 0
  const emptyToFill = rows.filter(r => r.planned === 0 && Math.max(r.avg, r.fixed) > 0)

  // Preenche só o que está vazio: o maior entre a média e o que já é fixo,
  // arredondado para cima de 10 em 10.
  function fillFromAverage() {
    editLimits(prev => {
      const next = { ...prev }
      for (const r of emptyToFill) next[r.cat.name] = String(Math.ceil(Math.max(r.avg, r.fixed) / 10) * 10)
      return next
    })
  }

  const investActual = useMemo(
    () => sumInvestmentContributions(transactions, boards),
    [transactions, boards],
  )

  // 50/30/20: cada gasto entra no balde da sua categoria (a subcategoria pode
  // ter etiqueta própria). Só sugestão: a etiqueta é editável em Categorias.
  const bucketSummary = useMemo(() => {
    const byName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]))
    const totals: Record<'essencial' | 'estilo' | 'futuro' | 'sem', number> = { essencial: 0, estilo: 0, futuro: 0, sem: 0 }
    let total = 0
    for (const t of realMovements(transactions)) {
      if (t.type !== 'despesa') continue
      const cat = byName.get(t.category.trim().toLowerCase())
      const mother = cat?.parent_id ? categories.find(m => m.id === cat.parent_id) : null
      const bucket = cat?.bucket ?? mother?.bucket ?? null
      totals[bucket ?? 'sem'] += Number(t.amount)
      total += Number(t.amount)
    }
    return { totals, total }
  }, [transactions, categories])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function renderRow(r: typeof rows[number]) {
    const open = expanded.has(r.cat.id)
    return (
      <div key={r.cat.id} className="py-3">
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => r.kids.length > 0 && toggle(r.cat.id)}
            className={cn('flex items-center gap-2 flex-1 min-w-[180px] text-left', r.kids.length === 0 && 'cursor-default')}
          >
            {r.kids.length > 0
              ? (open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />)
              : <span className="w-4 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{r.cat.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                {r.fixed > 0 && <>fixo {fmt(r.fixed)} · </>}
                {average.months > 0 ? <>média {fmt(r.avg)}</> : 'sem histórico'}
              </p>
            </div>
          </button>

          <div className="w-32 shrink-0">
            {r.own === 0 && r.kidsSum > 0 ? (
              <div className="h-9 flex items-center justify-end px-3 text-sm text-slate-500 dark:text-slate-400" title="Soma dos limites das subcategorias">
                {fmt(r.kidsSum)}
              </div>
            ) : (
              <CurrencyInput
                value={categoryLimits[r.cat.name] ?? ''}
                onChange={v => setLimit(r.cat.name, v)}
                className="h-9 text-sm text-right"
              />
            )}
          </div>
        </div>

        {r.own > 0 && r.kidsSum > r.own && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 ml-10">
            As subcategorias somam {fmt(r.kidsSum)}, mais que o limite da categoria.
          </p>
        )}
        {r.fixed > 0 && r.planned > 0 && r.planned < r.fixed && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 ml-10">
            Só os gastos fixos daqui já somam {fmt(r.fixed)}.
          </p>
        )}

        {open && (
          <div className="mt-2 ml-10 pl-3 border-l-2 border-slate-100 dark:border-white/[0.08] space-y-2">
            {r.kids.map(k => {
              const kAvg = average.byCategory[k.name] ?? 0
              const kFixed = fixed.byCategory[k.name] ?? 0
              return (
                <div key={k.id} className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{k.name}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {kFixed > 0 && <>fixo {fmt(kFixed)} · </>}
                      média {fmt(kAvg)}
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <CurrencyInput
                      value={categoryLimits[subKey(k.name)] ?? ''}
                      onChange={v => setLimit(subKey(k.name), v)}
                      placeholder="opcional"
                      className="h-8 text-xs text-right"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Planejamento Mensal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Decida para onde vai o dinheiro do mês e acompanhe enquanto gasta</p>
        </div>
        <PeriodFilter month={month} year={year} onMonthChange={changeMonth} onYearChange={changeYear} />
      </div>

      {loading || recurringLoading || decisionsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <>
          {/* Orçamento do mês: receita, investimento e o que sobra */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={toggleBudget}
                className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-left"
                aria-expanded={budgetOpen}
              >
                {budgetOpen
                  ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                <ClipboardList className="h-4 w-4 text-blue-500 shrink-0" />
                Orçamento do mês
              </button>
              <div className="flex items-center gap-3">
                <SaveIndicator status={saveStatus} error={saveError} />
                {budgetOpen && (
                <button
                  type="button"
                  onClick={() => setTemplateOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Usar template
                </button>
                )}
              </div>
            </div>

            {/* Recolhido: só o resultado da conta do mês */}
            {!budgetOpen && (
              <div className={cn(
                'flex justify-between text-sm font-semibold -mt-2',
                free >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500',
              )}>
                <span>{free >= 0 ? 'Livre para planejar' : 'Planejado além da receita'}</span>
                <span className="tabular-nums">{fmt(Math.abs(free))}</span>
              </div>
            )}

            {budgetOpen && templateOpen && (
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
                {incomeNum === 0 && (
                  <p className="col-span-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Preencha a receita prevista para aplicar valores automaticamente.
                  </p>
                )}
              </div>
            )}

            {budgetOpen && (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Receita prevista
                </Label>
                <CurrencyInput value={expectedIncome} onChange={editIncome} />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Recebido até agora: <span className="text-green-600 dark:text-green-400 font-medium">{fmt(actualIncome)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <PiggyBank className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Investimento previsto
                </Label>
                <CurrencyInput value={investmentTarget} onChange={editInvest} />
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Aportado até agora: <span className="text-blue-600 dark:text-blue-400 font-medium">{fmt(investActual)}</span>
                </p>
              </div>
            </div>

            {/* A conta do mês */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Receita prevista</span><span className="tabular-nums">{fmt(incomeNum)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>− Investimento</span><span className="tabular-nums">{fmt(investNum)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>
                  − Despesas planejadas
                  {expensesTargetDisplay > 0 && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500"> · {fmt(expensesTargetDisplay)} já são fixos</span>
                  )}
                </span>
                <span className="tabular-nums">{fmt(totalPlanned)}</span>
              </div>
              <div className={cn(
                'flex justify-between font-semibold pt-1.5 border-t border-slate-100 dark:border-slate-700',
                free >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500',
              )}>
                <span>{free >= 0 ? 'Livre para planejar' : 'Planejado além da receita'}</span>
                <span className="tabular-nums">{fmt(Math.abs(free))}</span>
              </div>
            </div>
            </>)}
          </div>

          {/* Categorias: onde se planeja. O acompanhamento fica na tabela abaixo. */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 px-6 py-4">
            <div className="flex items-start justify-between gap-3 flex-wrap pb-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Despesas por categoria</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Digite quanto quer gastar em cada uma. Abra a categoria para limitar as subcategorias.
                </p>
              </div>
              {emptyToFill.length > 0 && average.months > 0 && (
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fillFromAverage}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Preencher pela média
                </Button>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 pb-2">
              <span className="flex-1">Categoria</span>
              <span className="w-32 text-right">Planejado</span>
            </div>

            {activeRows.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">
                Nenhum gasto registrado ainda. Importe um extrato para ver as categorias aqui.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {activeRows.map(renderRow)}
              </div>
            )}

            {quietRows.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuiet(v => !v)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  {showQuiet ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  {showQuiet ? 'Ocultar' : 'Mostrar'} {quietRows.length} categoria{quietRows.length === 1 ? '' : 's'} sem movimento
                </button>
                {showQuiet && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {quietRows.map(renderRow)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Planejado × Realizado — com o gasto do mês */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Planejado × Realizado</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quanto já saiu em cada categoria planejada neste mês</p>
            </div>

            {!hasTable ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Defina a receita ou o limite de alguma categoria acima para ver o comparativo aqui.
                </p>
              </div>
            ) : (
              <>
              {/* Celular: lista em duas linhas por item */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                {incomeNum > 0 && (
                  <MobileRow label="Receita" strong planned={incomeNum} actual={actualIncome} actualClass="text-green-600 dark:text-green-400" higherIsBetter />
                )}
                {tableRows.map(r => (
                  <Fragment key={r.cat.id}>
                    <MobileRow label={r.cat.name} planned={r.planned} actual={r.actual} actualClass="text-red-500" />
                    {r.kids
                      .filter(k => parseNum(categoryLimits[subKey(k.name)] ?? '') > 0)
                      .map(k => (
                        <MobileRow
                          key={k.id}
                          label={k.name}
                          sub
                          planned={parseNum(categoryLimits[subKey(k.name)] ?? '')}
                          actual={actual.byCategory[k.name] ?? 0}
                          actualClass="text-red-500"
                        />
                      ))}
                  </Fragment>
                ))}
                {investNum > 0 && (
                  <MobileRow label="Investir (aportes)" strong planned={investNum} actual={investActual} actualClass="text-blue-600 dark:text-blue-400" higherIsBetter />
                )}
                {totalPlanned > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-700/30">
                    <MobileRow label="Total Despesas" strong planned={totalPlanned} actual={actualPlanned} actualClass="text-red-500" />
                  </div>
                )}
              </div>

              <div className="hidden sm:block overflow-x-auto">
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
                    {incomeNum > 0 && (
                      <TableRow label="Receita" strong planned={incomeNum} actual={actualIncome} actualClass="text-green-600 dark:text-green-400" higherIsBetter />
                    )}

                    {tableRows.map(r => (
                      <Fragment key={r.cat.id}>
                        <TableRow label={r.cat.name} planned={r.planned} actual={r.actual} actualClass="text-red-500" />
                        {r.kids
                          .filter(k => parseNum(categoryLimits[subKey(k.name)] ?? '') > 0)
                          .map(k => (
                            <TableRow
                              key={k.id}
                              label={k.name}
                              sub
                              planned={parseNum(categoryLimits[subKey(k.name)] ?? '')}
                              actual={actual.byCategory[k.name] ?? 0}
                              actualClass="text-red-500"
                            />
                          ))}
                      </Fragment>
                    ))}

                    {investNum > 0 && (
                      <TableRow label="Investir (aportes)" strong planned={investNum} actual={investActual} actualClass="text-blue-600 dark:text-blue-400" higherIsBetter />
                    )}
                  </tbody>

                  {totalPlanned > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-700/30 border-t-2 border-slate-200 dark:border-slate-600">
                        <td className="px-6 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">Total Despesas</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(totalPlanned)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-red-500">{fmt(actualPlanned)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          <span className={actualPlanned <= totalPlanned ? 'text-emerald-600' : 'text-red-500'}>
                            {actualPlanned > totalPlanned ? '+' : ''}{fmt(actualPlanned - totalPlanned)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center"><StatusBadge planned={totalPlanned} actual={actualPlanned} /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {untracked > 0 && totalPlanned > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 px-5 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                  + {fmt(untracked)} em categorias sem limite, fora do &ldquo;Total Despesas&rdquo;. Gasto total do mês: {fmt(actual.total)}.
                </p>
              )}
              </>
            )}
          </div>

          {internal.count > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
              Fora do realizado: {internal.count} lançamento{internal.count === 1 ? '' : 's'} de movimentação
              entre suas contas (pagamento de fatura, transferência). Eles continuam no saldo das contas.
            </p>
          )}

          {/* 50/30/20 — sugestão, ajustável mudando a etiqueta das categorias */}
          {bucketSummary.total > 0 && (
            <div className="nobli-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Essencial · Estilo de vida · Futuro</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Sugestão 50/30/20 sobre as despesas do período. Para mudar onde uma categoria entra,
                    edite a etiqueta dela em Configurações › Categorias.
                  </p>
                </div>
                <a href="/settings/categories" className="text-xs text-blue-600 hover:underline shrink-0">Ajustar etiquetas →</a>
              </div>

              {bucketSummary.totals.sem / bucketSummary.total > 0.15 && (
                <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>{fmt(bucketSummary.totals.sem)}</strong> ({Math.round((bucketSummary.totals.sem / bucketSummary.total) * 100)}%)
                    do que você gastou está em categorias sem etiqueta — em geral, o que ficou dentro de &ldquo;Outros&rdquo;.
                    Enquanto isso, esta divisão não reflete a sua vida.{' '}
                    <a href="/settings/categories" className="underline font-medium">Organize suas categorias</a>:
                    mova as subcategorias para a categoria certa e marque se cada uma é essencial, estilo de vida ou futuro.
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {([
                  ['essencial', 'Essencial', 50, 'bg-blue-500'],
                  ['estilo', 'Estilo de vida', 30, 'bg-amber-500'],
                  ['futuro', 'Futuro', 20, 'bg-emerald-500'],
                  ['sem', 'Sem etiqueta', null, 'bg-slate-300 dark:bg-slate-600'],
                ] as const).map(([key, label, target, color]) => {
                  const value = bucketSummary.totals[key]
                  if (key === 'sem' && value <= 0.005) return null
                  const pct = bucketSummary.total > 0 ? (value / bucketSummary.total) * 100 : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-300">
                          {label}
                          {target !== null && (
                            <span className="text-slate-400 dark:text-slate-500"> · sugerido {target}%</span>
                          )}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 font-semibold tabular-nums">
                          {pct.toFixed(0)}% · {fmt(value)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}

export default withPlan(
  'planning',
  PlanningPage,
  'Defina quanto quer gastar em cada categoria e acompanhe planejado × realizado durante o mês.',
)
