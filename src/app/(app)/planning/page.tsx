'use client'

import { withPlan } from '@/components/plan/with-plan'
import { useVitrine } from '@/components/plan/vitrine'

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
import {
  CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, PiggyBank, Sparkles, ChevronDown, ChevronRight,
  CalendarDays, PieChart, BarChart3, Target, List as ListIcon, CalendarClock, RefreshCw, ArrowRight, Pencil, Home, Coffee,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGoals } from '@/hooks/use-goals'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { createClient } from '@/lib/supabase/client'

type PillarKey = 'essencial' | 'estilo' | 'futuro'

// Cores validadas para daltonismo; o texto ao lado de cada barra carrega o
// nome e o valor, então a cor nunca é a única pista.
const PILLARS: { key: PillarKey; label: string; color: string; icon: React.ElementType; hint: string }[] = [
  { key: 'essencial', label: 'Essenciais',     color: '#10b981', icon: Home,      hint: 'Moradia, alimentação, transporte, saúde, contas básicas' },
  { key: 'estilo',    label: 'Estilo de vida', color: '#8b5cf6', icon: Coffee,    hint: 'Lazer, compras, restaurantes, viagens, assinaturas' },
  { key: 'futuro',    label: 'Futuro',         color: '#f59e0b', icon: PiggyBank, hint: 'Investimentos, reserva de emergência, objetivos' },
]

const PRESETS = [
  { label: 'Equilibrado',    essencial: 50, estilo: 30, futuro: 20 },
  { label: 'Investidor',     essencial: 45, estilo: 25, futuro: 30 },
  { label: 'Quitar dívidas', essencial: 60, estilo: 20, futuro: 20 },
] as const

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function CardTitle({ icon: Icon, title, subtitle, action }: {
  icon: React.ElementType; title: string; subtitle?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

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
  // Em vitrine (sem o plano), abre no último mês fechado: o mês corrente
  // costuma estar pela metade.
  const vitrine = useVitrine()
  const [month, setMonth] = useState(vitrine.ativo ? vitrine.mes : now.getMonth() + 1)
  const [year, setYear] = useState(vitrine.ativo ? vitrine.ano : now.getFullYear())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [boardId, setBoardId] = useState('all')
  const [editorOpen, setEditorOpen] = useState(false)
  // Com o painel "Ajustar orçamento" aberto nada é gravado sozinho: só no
  // botão Salvar. Cancelar volta tudo para como estava ao abrir.
  const editorOpenRef = useRef(false)
  useEffect(() => { editorOpenRef.current = editorOpen }, [editorOpen])
  const [discardAsk, setDiscardAsk] = useState(false)
  const [pendingFuturoPct, setPendingFuturoPct] = useState<number | null>(null)
  const [tableOpen, setTableOpen] = useState(false)
  const [pillarTab, setPillarTab] = useState<PillarKey>('essencial')
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
  // "Todas as contas" usa a mesma exclusão do dashboard; uma conta escolhida
  // mostra só ela.
  const accountFilter = boardId === 'all' ? { exclude_board_ids: exclude } : { board_id: boardId }
  const { transactions } = useTransactions({ month, year, ...accountFilter })

  // Os três meses anteriores, para a média de cada categoria.
  const p1 = monthsBack(month, year, 1)
  const p2 = monthsBack(month, year, 2)
  const p3 = monthsBack(month, year, 3)
  const { transactions: prev1 } = useTransactions({ ...p1, ...accountFilter })
  const { transactions: prev2 } = useTransactions({ ...p2, ...accountFilter })
  const { transactions: prev3 } = useTransactions({ ...p3, ...accountFilter })

  const { categories } = useCategories()
  const motherNames = useMemo(() => motherNameByCategory(categories), [categories])

  const { plan, loading, loadedKey, savePlan } = useBudgetPlan(month, year)
  // Plano do mês anterior, só para o "% em relação ao mês anterior".
  const { plan: prevPlan } = useBudgetPlan(p1.month, p1.year)
  const { goals } = useGoals()
  const { defaultInvestmentPct, updatePreferences } = useUserPreferences()

  // Percentuais de Essencial e Estilo de vida: preferência da pessoa, guardada
  // no perfil (não muda de mês a mês). O Futuro é o investimento previsto do
  // plano — o mesmo "% da receita" que o Dashboard usa.
  const [basePct, setBasePct] = useState({ essencial: 50, estilo: 30 })
  const pctDirty = useRef(false)
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const saved = user?.user_metadata?.plan_pillars
      if (saved && typeof saved.essencial === 'number' && typeof saved.estilo === 'number') {
        setBasePct({ essencial: saved.essencial, estilo: saved.estilo })
      }
    })
  }, [])
  useEffect(() => {
    if (!pctDirty.current || editorOpenRef.current) return
    const t = setTimeout(() => {
      pctDirty.current = false
      createClient().auth.updateUser({ data: { plan_pillars: basePct } })
    }, 800)
    return () => clearTimeout(t)
  }, [basePct])

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

  async function saveNow(): Promise<boolean> {
    if (!dirty.current) return true
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
      dirty.current = true
      return false
    }
    setSaveStatus('saved')
    return true
  }
  const saveRef = useRef(saveNow)
  // Refs atualizados depois de cada render: o save lê sempre o último valor.
  useEffect(() => {
    latest.current = { month, year, expectedIncome, investmentTarget, categoryLimits, expensesTargetDisplay }
    saveRef.current = saveNow
  })

  useEffect(() => {
    if (!dirty.current || editorOpenRef.current) return
    const t = setTimeout(() => saveRef.current(), 1200)
    return () => clearTimeout(t)
  }, [expectedIncome, investmentTarget, categoryLimits])

  // Saiu da tela com algo pendente: grava antes de ir.
  // Com o painel aberto e sem Salvar, a edição é descartada.
  useEffect(() => () => { if (!editorOpenRef.current) saveRef.current() }, [])

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
  // Soma dos limites efetivos (categoria ou suas subcategorias, nunca os dois).
  const totalPlannedLimits = rows.reduce((sum, r) => sum + r.planned, 0)
  const investNum = parseNum(investmentTarget)
  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0)
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

  // ── Pilares 50/30/20 ─────────────────────────────────────────────────────
  const futuroPct = incomeNum > 0 && investNum > 0 ? Math.round((investNum / incomeNum) * 100) : defaultInvestmentPct
  const pillarPct: Record<PillarKey, number> = { ...basePct, futuro: futuroPct }
  const pillarTargets: Record<PillarKey, number> = {
    essencial: (incomeNum * basePct.essencial) / 100,
    estilo: (incomeNum * basePct.estilo) / 100,
    futuro: investNum > 0 ? investNum : (incomeNum * futuroPct) / 100,
  }
  // Futuro = gastos com etiqueta "futuro" + o que foi aportado em investimento.
  const pillarSpent: Record<PillarKey, number> = {
    essencial: bucketSummary.totals.essencial,
    estilo: bucketSummary.totals.estilo,
    futuro: bucketSummary.totals.futuro + investActual,
  }
  const untaggedShare = bucketSummary.total > 0 ? bucketSummary.totals.sem / bucketSummary.total : 0

  function setPillar(key: PillarKey, value: number) {
    const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)))
    if (key === 'futuro') {
      editInvest(String(Math.round((incomeNum * v) / 100)))
      setPendingFuturoPct(v)
      return
    }
    pctDirty.current = true
    setBasePct(prev => ({ ...prev, [key]: v }))
  }
  const [snapshot, setSnapshot] = useState<{ expectedIncome: string; investmentTarget: string; categoryLimits: Record<string, string>; basePct: { essencial: number; estilo: number } } | null>(null)
  const [savingEditor, setSavingEditor] = useState(false)
  function openEditor() {
    setSnapshot({ expectedIncome, investmentTarget, categoryLimits, basePct })
    setPendingFuturoPct(null)
    setDiscardAsk(false)
    setSaveStatus('idle')
    setSaveError(null)
    setEditorOpen(true)
  }
  const editorChanged = editorOpen && !!snapshot && (
    pendingFuturoPct !== null ||
    JSON.stringify({ expectedIncome, investmentTarget, categoryLimits, basePct }) !== JSON.stringify(snapshot)
  )
  async function saveEditor() {
    setSavingEditor(true)
    const ok = await saveNow()
    if (ok && snapshot && JSON.stringify(basePct) !== JSON.stringify(snapshot.basePct)) {
      pctDirty.current = false
      await createClient().auth.updateUser({ data: { plan_pillars: basePct } })
    }
    if (ok && pendingFuturoPct !== null) await updatePreferences({ investment_pct: pendingFuturoPct })
    setSavingEditor(false)
    if (ok) { setPendingFuturoPct(null); setEditorOpen(false) }
  }
  function discardEditor() {
    const snap = snapshot
    if (snap) {
      setExpectedIncome(snap.expectedIncome)
      setInvestmentTarget(snap.investmentTarget)
      setCategoryLimits(snap.categoryLimits)
      setBasePct(snap.basePct)
    }
    dirty.current = false
    pctDirty.current = false
    setPendingFuturoPct(null)
    setSaveStatus('idle')
    setDiscardAsk(false)
    setEditorOpen(false)
  }
  // Fechar pelo X ou clicando fora: se mudou algo, pergunta antes de descartar.
  function requestCloseEditor() {
    if (editorChanged) setDiscardAsk(true)
    else discardEditor()
  }

  function applyPreset(pr: (typeof PRESETS)[number]) {
    setPillar('essencial', pr.essencial)
    setPillar('estilo', pr.estilo)
    setPillar('futuro', pr.futuro)
  }

  // Só aparece quando a renda mudou de fato (arredondado, "+0%" não diz nada).
  const incomeChangeRaw = prevPlan && prevPlan.expected_income > 0 && incomeNum > 0
    ? ((incomeNum - prevPlan.expected_income) / prevPlan.expected_income) * 100
    : null
  const incomeChange = incomeChangeRaw !== null && Math.abs(incomeChangeRaw) >= 0.5 ? incomeChangeRaw : null
  const summaryIncome = incomeNum > 0 ? incomeNum : actualIncome
  const projected = summaryIncome - actual.total

  const status = (() => {
    const neutral = 'bg-slate-50 border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08]'
    if (incomeNum === 0) {
      return { title: 'Defina sua renda', text: 'Sem a renda prevista não dá para calcular o limite de cada pilar.', subtitle: 'Falta a renda prevista do mês.', icon: AlertTriangle, box: neutral, iconCls: 'text-slate-400', titleCls: 'text-slate-700 dark:text-slate-200' }
    }
    const spending: PillarKey[] = ['essencial', 'estilo']
    const over = spending.filter(k => pillarSpent[k] > pillarTargets[k])
    if (over.length > 0) {
      const k = over[0]
      return {
        title: 'Atenção: passou do limite',
        text: `${PILLARS.find(p => p.key === k)!.label} já passou ${fmt(pillarSpent[k] - pillarTargets[k])} do planejado.`,
        subtitle: 'Algum pilar estourou este mês.', icon: XCircle,
        box: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50', iconCls: 'text-red-500', titleCls: 'text-red-600 dark:text-red-400',
      }
    }
    const near = spending.filter(k => pillarTargets[k] > 0 && pillarSpent[k] / pillarTargets[k] > 0.9)
    if (near.length > 0) {
      const k = near[0]
      return {
        title: 'Perto do limite',
        text: `${PILLARS.find(p => p.key === k)!.label} já usou ${Math.round((pillarSpent[k] / pillarTargets[k]) * 100)}% do limite.`,
        subtitle: 'Vale segurar os gastos até o fim do mês.', icon: AlertTriangle,
        box: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50', iconCls: 'text-amber-500', titleCls: 'text-amber-700 dark:text-amber-300',
      }
    }
    return {
      title: 'No caminho certo!', text: 'Seus gastos estão dentro do planejamento 50/30/20.',
      subtitle: 'Você está dentro do planejado este mês.', icon: CheckCircle,
      box: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50', iconCls: 'text-emerald-500', titleCls: 'text-emerald-700 dark:text-emerald-300',
    }
  })()

  // Gasto por categoria principal dentro de cada pilar.
  const byPillarMother = useMemo(() => {
    const byName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]))
    const out: Record<PillarKey, Record<string, number>> = { essencial: {}, estilo: {}, futuro: {} }
    for (const t of realMovements(transactions)) {
      if (t.type !== 'despesa') continue
      const cat = byName.get(t.category.trim().toLowerCase())
      const mother = cat?.parent_id ? categories.find(m => m.id === cat.parent_id) : null
      const bucket = (cat?.bucket ?? mother?.bucket ?? null) as PillarKey | null
      if (!bucket) continue
      const name = motherOf(t.category, motherNames, t.type)
      out[bucket][name] = (out[bucket][name] ?? 0) + Number(t.amount)
    }
    return out
  }, [transactions, categories, motherNames])
  const currentPillar = PILLARS.find(p => p.key === pillarTab)!
  const topCategories = (() => {
    const entries = Object.entries(byPillarMother[pillarTab])
    const total = entries.reduce((s, [, v]) => s + v, 0)
    return entries
      .map(([name, amount]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  })()

  // Próximos gastos fixos: cada fixo confirmado costuma cair no mesmo dia do
  // mês da última vez — daí sai a previsão dos próximos 30 dias (a partir de hoje).
  const upcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const clampDay = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))
    type Upcoming = { key: string; name: string; amount: number; date: Date; days: number }
    const groups = new Map<string, { category: string; total: number; days: number; items: Upcoming[] }>()
    for (const item of buildDisplayItems(recurring, new Map(), subcategoryNames)) {
      if (item.type !== 'despesa' || decisions.get(item.key) !== 'confirmed' || !item.lastDate) continue
      const day = Number(item.lastDate.slice(8, 10))
      let date = clampDay(today.getFullYear(), today.getMonth(), day)
      if (date < today) date = clampDay(today.getFullYear(), today.getMonth() + 1, day)
      const days = Math.round((date.getTime() - today.getTime()) / 86400000)
      if (days > 30) continue
      const category = motherOf(item.category, motherNames, 'despesa')
      const g = groups.get(category) ?? { category, total: 0, days, items: [] }
      g.total += item.avgAmount
      g.days = Math.min(g.days, days)
      g.items.push({ key: item.key, name: item.name, amount: item.avgAmount, date, days })
      groups.set(category, g)
    }
    return [...groups.values()]
      .map(g => ({ ...g, items: g.items.sort((a, b) => a.days - b.days) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [recurring, decisions, subcategoryNames, motherNames])
  const [openUpcoming, setOpenUpcoming] = useState<string | null>(null)

  // Gasto médio mensal, para "a reserva cobre N meses de despesas".
  const averageTotal = useMemo(() => {
    const months = [prev1, prev2, prev3].map(realMovements).map(sumDespesa).filter(m => m.total > 0)
    return months.length ? months.reduce((s, m) => s + m.total, 0) / months.length : 0
  }, [prev1, prev2, prev3]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reserva de emergência primeiro, depois as mais adiantadas.
  const topGoals = [...goals]
    .sort((a, b) => {
      if ((a.type === 'reserva') !== (b.type === 'reserva')) return a.type === 'reserva' ? -1 : 1
      const pa = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0
      const pb = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0
      return pb - pa
    })
    .slice(0, 2)

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
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Planejamento 50/30/20</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Organize seu dinheiro, viva melhor e conquiste seus objetivos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="shrink-0">
            <PeriodFilter month={month} year={year} onMonthChange={changeMonth} onYearChange={changeYear} />
          </div>
          <select
            value={boardId}
            onChange={e => setBoardId(e.target.value)}
            className="flex-1 min-w-0 lg:flex-none lg:w-48 h-9 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-3 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="all">Todas as contas</option>
            {boards.filter(b => !b.is_investment).map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading || recurringLoading || decisionsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-white dark:bg-slate-800 rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <>
          {/* Linha 1: orçamento do mês + distribuição 50/30/20 */}
          <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-4">
            <div className="nobli-card p-5 flex flex-col">
              <CardTitle icon={CalendarDays} title="Orçamento do mês" subtitle={`Sua renda e limites para ${MONTH_NAMES[month - 1]} ${year}`} />
              <p className="text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100 tabular-nums mt-4">
                {fmt(incomeNum)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Renda mensal prevista</p>
              {incomeChange !== null && (
                <p className={cn('text-xs mt-2 flex items-center gap-1', incomeChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                  {incomeChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(0)}%
                  <span className="text-slate-400 dark:text-slate-500"> em relação ao mês anterior</span>
                </p>
              )}
              {incomeNum === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Defina a renda prevista para calcular os limites de cada pilar.
                </p>
              )}
              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <SaveIndicator status={saveStatus} error={saveError} />
                <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={openEditor}>
                  <Pencil className="h-3.5 w-3.5" /> Ajustar orçamento
                </Button>
              </div>
            </div>

            <div className="nobli-card p-5">
              <CardTitle icon={PieChart} title="Distribuição 50/30/20" subtitle="Quanto da renda vai para cada pilar" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 sm:divide-x divide-slate-100 dark:divide-white/[0.06] mt-4">
                {PILLARS.map(p => (
                  <div key={p.key} className="sm:px-4 first:sm:pl-0 last:sm:pr-0">
                    <div className="border-l-4 pl-3" style={{ borderColor: p.color }}>
                      <p className="text-2xl font-extrabold tabular-nums" style={{ color: p.color }}>{pillarPct[p.key]}%</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{p.label}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums mt-0.5">{fmt(pillarTargets[p.key])}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 leading-snug">{p.hint}</p>
                  </div>
                ))}
              </div>
              {untaggedShare > 0.15 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-4 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span>
                    {fmt(bucketSummary.totals.sem)} do que você gastou está em categorias sem etiqueta e não entra em nenhum pilar.{' '}
                    <a href="/settings/categories" className="underline font-medium">Ajustar etiquetas</a>
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Linha 2: acompanhamento por pilar + status e resumo */}
          <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-4">
            <div className="nobli-card p-5">
              <CardTitle icon={BarChart3} title="Acompanhamento do mês" subtitle="Gastos até hoje vs. limite de cada pilar" />
              <div className="space-y-4 mt-4">
                {PILLARS.map(p => {
                  const target = pillarTargets[p.key]
                  const spent = pillarSpent[p.key]
                  const pct = target > 0 ? (spent / target) * 100 : 0
                  return (
                    <div key={p.key} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: p.color + '1f' }}>
                        <p.icon className="h-4 w-4" style={{ color: p.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                            {p.label} <span className="text-slate-400 dark:text-slate-500">({pillarPct[p.key]}%)</span>
                          </p>
                          <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: p.color }}>
                            {target > 0 ? `${pct.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                        <p className="text-xs tabular-nums mt-0.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(spent)}</span>
                          <span className="text-slate-400 dark:text-slate-500"> de {fmt(target)}</span>
                        </p>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: p.color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {investActual > 0 && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3">
                  Futuro inclui {fmt(investActual)} aportados em contas de investimento.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="nobli-card p-5">
                <CardTitle icon={Target} title="Status do planejamento" subtitle={status.subtitle} />
                <div className={cn('mt-4 rounded-xl border p-3.5 flex items-center gap-3', status.box)}>
                  <status.icon className={cn('h-6 w-6 shrink-0', status.iconCls)} />
                  <div>
                    <p className={cn('text-sm font-semibold', status.titleCls)}>{status.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{status.text}</p>
                  </div>
                </div>
              </div>

              <div className="nobli-card p-5">
                <CardTitle icon={TrendingUp} title="Resumo do mês" />
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/[0.06] mt-4">
                  <div className="pr-3 min-w-0">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Renda</p>
                    <p className="text-sm sm:text-base font-bold tabular-nums text-green-600 truncate">{fmt(summaryIncome)}</p>
                  </div>
                  <div className="px-3 min-w-0">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Gastos</p>
                    <p className="text-sm sm:text-base font-bold tabular-nums text-red-500 truncate">-{fmt(actual.total)}</p>
                  </div>
                  <div className="pl-3 min-w-0">
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Saldo projetado</p>
                    <p className={cn('text-sm sm:text-base font-bold tabular-nums truncate', projected >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500')}>
                      {fmt(projected)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Linha 3: principais categorias por pilar + próximos gastos fixos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="nobli-card p-5">
              <CardTitle icon={ListIcon} title="Principais categorias do mês" subtitle="Seu gasto por categoria dentro de cada pilar" />
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg mt-4">
                {PILLARS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPillarTab(p.key)}
                    className={cn(
                      'flex-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all',
                      pillarTab === p.key
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {topCategories.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Nenhum gasto neste pilar ainda.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] mt-2">
                  {topCategories.map(c => (
                    <div key={c.name} className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                      <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200 w-24 text-right shrink-0">{fmt(c.amount)}</span>
                      <span className="text-xs tabular-nums text-slate-400 w-9 text-right shrink-0">{c.pct.toFixed(0)}%</span>
                      <div className="hidden sm:block w-28 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, backgroundColor: currentPillar.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => { setTableOpen(true); setTimeout(() => document.getElementById('plano-tabela')?.scrollIntoView({ behavior: 'smooth' }), 50) }}
                className="mt-3 ml-auto flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Ver todas as categorias <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="nobli-card p-5">
              <CardTitle
                icon={CalendarClock}
                title="Próximos gastos fixos"
                subtitle="Próximos 30 dias · pela data em que cada um costuma cair"
                action={<a href="/fixos" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">Ver todos <ArrowRight className="h-3.5 w-3.5" /></a>}
              />
              {upcoming.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                  Nenhum gasto fixo confirmado nos próximos 30 dias.{' '}
                  <a href="/fixos" className="text-blue-600 dark:text-blue-400 hover:underline">Confirmar em Recorrências</a>
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] mt-2">
                  {upcoming.map(g => {
                    const open = openUpcoming === g.category
                    return (
                      <div key={g.category}>
                        <button
                          type="button"
                          onClick={() => setOpenUpcoming(open ? null : g.category)}
                          className="w-full flex items-center gap-3 py-2.5 text-left"
                        >
                          <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <RefreshCw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
                              <span className="truncate">{g.category}</span>
                              <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {g.items.length} {g.items.length === 1 ? 'fixo' : 'fixos'}
                            </p>
                          </div>
                          <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200 shrink-0">{fmt(g.total)}</span>
                          <span className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 w-[68px] text-center',
                            g.days === 0
                              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                          )}>
                            {g.days === 0 ? 'Hoje' : g.days === 1 ? 'Amanhã' : `Em ${g.days} dias`}
                          </span>
                        </button>
                        {open && (
                          <div className="pl-11 pb-2 space-y-1.5">
                            {g.items.map(u => (
                              <div key={u.key} className="flex items-center gap-3 text-xs">
                                <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">
                                  {u.name} <span className="text-slate-400 dark:text-slate-500">· {u.date.getDate()} de {MONTH_NAMES[u.date.getMonth()].toLowerCase()}</span>
                                </span>
                                <span className="tabular-nums text-slate-600 dark:text-slate-300 shrink-0">{fmt(u.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Linha 4: metas + chamada para editar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="nobli-card p-5">
              <CardTitle
                icon={Target}
                title="Metas e reserva de emergência"
                subtitle="Seu futuro em construção"
                action={<a href="/goals" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">Ver todas <ArrowRight className="h-3.5 w-3.5" /></a>}
              />
              {topGoals.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                  Nenhuma meta ainda.{' '}
                  <a href="/goals" className="text-blue-600 dark:text-blue-400 hover:underline">Criar a reserva de emergência</a>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {topGoals.map(g => {
                    const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0
                    const monthsCovered = g.type === 'reserva' && average.months > 0 && averageTotal > 0
                      ? g.currentAmount / averageTotal : null
                    return (
                      <div key={g.id} className="rounded-xl border border-slate-100 dark:border-white/[0.06] p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{g.name}</p>
                          <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400 shrink-0">{pct.toFixed(0)}%</span>
                        </div>
                        <p className="text-[11px] tabular-nums mt-0.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{fmt(g.currentAmount)}</span>
                          <span className="text-slate-400 dark:text-slate-500"> de {fmt(g.targetAmount)}</span>
                        </p>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: g.color }} />
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                          {monthsCovered !== null
                            ? `Cobre ${monthsCovered.toFixed(1).replace('.', ',')} meses de despesas`
                            : `Prazo: ${g.deadline.split('-').reverse().join('/')}`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="nobli-card p-5 flex items-center gap-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-transparent">
              <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-600/25">
                <Target className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Mantenha o foco nos seus objetivos</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Revise seu planejamento todo mês e ajuste os limites para viver hoje e conquistar amanhã.
                </p>
                <Button size="sm" className="mt-3 gap-1.5" onClick={openEditor}>
                  Editar planejamento <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Detalhe por categoria — recolhido */}
          <div id="plano-tabela" className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden scroll-mt-4">
            <button
              type="button"
              onClick={() => setTableOpen(v => !v)}
              aria-expanded={tableOpen}
              className="w-full px-5 sm:px-6 py-4 flex items-center gap-2 text-left"
            >
              {tableOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Planejado × Realizado por categoria</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quanto já saiu em cada categoria planejada neste mês</p>
              </div>
            </button>

            {tableOpen && (!hasTable ? (
              <div className="px-6 py-8 text-center border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  Defina limites por categoria em &ldquo;Ajustar orçamento&rdquo; para ver o comparativo aqui.
                </p>
              </div>
            ) : (
              <div className="border-t border-slate-100 dark:border-slate-700">
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
              </div>
            ))}
          </div>

          {internal.count > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
              Fora do realizado: {internal.count} lançamento{internal.count === 1 ? '' : 's'} de movimentação
              entre suas contas (pagamento de fatura, transferência). Eles continuam no saldo das contas.
            </p>
          )}

          {/* Painel de edição: renda, pilares e limites por categoria */}
          <Dialog open={editorOpen} onOpenChange={v => { if (v) openEditor(); else requestCloseEditor() }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Ajustar orçamento — {MONTH_NAMES[month - 1]} {year}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    Renda prevista
                  </Label>
                  <CurrencyInput value={expectedIncome} onChange={editIncome} />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Recebido até agora: <span className="text-green-600 dark:text-green-400 font-medium">{fmt(actualIncome)}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Divisão da renda</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESETS.map(pr => (
                        <button
                          key={pr.label}
                          type="button"
                          onClick={() => applyPreset(pr)}
                          className="text-[11px] font-medium px-2 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-600"
                        >
                          {pr.label} {pr.essencial}/{pr.estilo}/{pr.futuro}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {PILLARS.map(p => (
                      <div key={p.key} className="rounded-xl border border-slate-100 dark:border-white/[0.06] p-2.5">
                        <p className="text-[11px] font-medium" style={{ color: p.color }}>{p.label}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            // Zero aparece vazio: com "0" fixo não dava para apagar e
                            // digitar outro número. Ao clicar, o valor fica selecionado.
                            value={pillarPct[p.key] === 0 ? '' : pillarPct[p.key]}
                            placeholder="0"
                            onFocus={e => e.currentTarget.select()}
                            onChange={e => setPillar(p.key, Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                            className="h-8 text-sm text-right"
                          />
                          <span className="text-sm text-slate-400">%</span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">{fmt(pillarTargets[p.key])}</p>
                      </div>
                    ))}
                  </div>
                  {pillarPct.essencial + pillarPct.estilo + pillarPct.futuro !== 100 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Os três somam {pillarPct.essencial + pillarPct.estilo + pillarPct.futuro}% da renda.
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    O Futuro é o investimento previsto do mês. Os aportes em contas de investimento contam nele.
                  </p>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap pb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Limite por categoria <span className="font-normal text-slate-400">(opcional)</span></p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Detalhe dentro de cada pilar. Abra a categoria para limitar as subcategorias.
                      </p>
                    </div>
                    {emptyToFill.length > 0 && average.months > 0 && (
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={fillFromAverage}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Preencher pela média
                      </Button>
                    )}
                  </div>
                  {incomeNum > 0 && totalPlannedLimits > incomeNum && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                      Os limites somam {fmt(totalPlannedLimits)}, {fmt(totalPlannedLimits - incomeNum)} acima da renda prevista ({fmt(incomeNum)}).
                    </p>
                  )}
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
              </div>

              {/* Nada é gravado até clicar em Salvar. */}
              <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-5 px-5 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                {saveError && (
                  <p className="text-xs text-red-500 mb-2">{saveError}</p>
                )}
                {discardAsk ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-slate-600 dark:text-slate-300 flex-1 min-w-0">Descartar as alterações que não foram salvas?</p>
                    <Button variant="outline" size="sm" onClick={() => setDiscardAsk(false)}>Continuar editando</Button>
                    <Button variant="destructive" size="sm" onClick={discardEditor}>Descartar</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex-1 min-w-0">
                      {editorChanged ? 'Alterações ainda não salvas.' : 'Nenhuma alteração.'}
                    </p>
                    <Button variant="outline" size="sm" onClick={discardEditor} disabled={savingEditor}>Cancelar</Button>
                    <Button size="sm" onClick={saveEditor} disabled={!editorChanged || savingEditor}>
                      {savingEditor ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
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
