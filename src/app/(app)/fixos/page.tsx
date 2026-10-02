'use client'

import { withPlan } from '@/components/plan/with-plan'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRecurring } from '@/hooks/use-recurring'
import { useRecurringDecisions } from '@/hooks/use-recurring-decisions'
import { useCategories } from '@/hooks/use-categories'
import { createClient } from '@/lib/supabase/client'
import { DisplayItem, buildDisplayItems } from '@/lib/recurring-groups'
import { useSubcategoryNames } from '@/hooks/use-subcategory-names'
import { TransactionType } from '@/types'
import {
  RefreshCw, CheckCircle, EyeOff, Eye, AlertCircle, RotateCcw,
  Tag, ChevronRight,
  TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { EmptyState } from '@/components/ui/empty-state'
import { categoryIconKey, guessIconKey } from '@/lib/category-icons'
import {
  RecurringSummary, IncomeSplit, MonthCalendar, MissingAlert, FixedCategoryCard, RecurringHelp,
  PARCELAS_COLOR, type CategoryGroup,
} from '@/components/recurring/recurring-overview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Linha de item (pendente ou confirmado) ───────────────────────────────────
// Uma subcategoria (item.isGroup) abre para mostrar as descrições do extrato
// que caem nela; uma descrição solta não tem o que abrir.
function ItemRow({
  item, pending, label, sublabel, onConfirm, onIgnore, onUndo,
}: {
  item: DisplayItem
  pending: boolean
  label: string
  /** Caminho da categoria, mostrado só na lista de revisão. */
  sublabel?: string
  onConfirm: () => void
  onIgnore: () => void
  onUndo: () => void
}) {
  const [open, setOpen] = useState(false)
  const valueColor = item.type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-500'
  return (
    <div className="group rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!item.isGroup}
          onClick={() => setOpen(v => !v)}
          className="flex-1 min-w-0 text-left disabled:cursor-default"
        >
          <p className="text-sm text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
            {label}
            {item.isGroup && (
              <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
            )}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {sublabel && <>{sublabel} · </>}
            {item.monthsCount}x · última {formatDate(item.lastDate)}
            {item.isGroup && <> · {item.descriptions.length} descriç{item.descriptions.length === 1 ? 'ão' : 'ões'}</>}
          </p>
        </button>

        <span className={cn('text-sm font-semibold tabular-nums shrink-0', valueColor)}>
          {fmt(item.avgAmount)}
        </span>

        {pending ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline"
              className="h-7 text-xs gap-1 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={onConfirm}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirmar
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Ignorar" onClick={onIgnore}>
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUndo}
            title="Desfazer confirmação"
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {item.isGroup && open && (
        <div className="mt-1.5 ml-1 space-y-0.5">
          {item.descriptions.map(d => (
            <p key={d} className="text-xs text-slate-400 dark:text-slate-500 truncate">• {d}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Metadados de cada seção por tipo ────────────────────────────────────────────
const TYPE_SECTIONS: {
  type: TransactionType
  label: string
  icon: LucideIcon
  iconColor: string
  totalColor: string
  help: string
}[] = [
  {
    type: 'despesa', label: 'Despesas', icon: TrendingDown, iconColor: 'text-red-500', totalColor: 'text-red-500',
    help: 'Cobranças que se repetem todo mês (assinaturas, contas fixas). Confirmar aqui alimenta o total "Despesas fixas / mês" e o campo "Gastos Previstos" do Planejamento.',
  },
  {
    type: 'receita', label: 'Receitas', icon: TrendingUp, iconColor: 'text-green-500', totalColor: 'text-green-600',
    help: 'Entradas fixas que se repetem todo mês (ex: salário). Confirmar ajuda a identificar sua renda previsível — não entra no total de gasto fixo.',
  },
]

// ── Página principal ──────────────────────────────────────────────────────────
function FixosPage() {
  const { recurring, installments, loading, refetch: refetchRecurring } = useRecurring()
  const subcategoryNames = useSubcategoryNames()
  const { decisions, loading: decisionsLoading, setDecision }     = useRecurringDecisions()
  const { categories } = useCategories()

  function categoryColor(name: string): string {
    return categories.find(c => c.name === name)?.color ?? '#94a3b8'
  }

  // "Moradia › Aluguel": o caminho da categoria, para o card mostrar de onde
  // o item veio sem precisar do agrupador antigo.
  function categoryPath(name: string): string {
    const cat = categories.find(c => c.name === name)
    const mother = cat?.parent_id ? categories.find(m => m.id === cat.parent_id) : null
    return mother ? `${mother.name} › ${cat!.name}` : name
  }

  const mothers = useMemo(() => motherNameByCategory(categories), [categories])


  const [showIgnored, setShowIgnored] = useState<Set<TransactionType>>(new Set())
  function toggleIgnored(type: TransactionType) {
    setShowIgnored(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const displayItems = useMemo(
    () => buildDisplayItems(recurring, new Map(), subcategoryNames),
    [recurring, subcategoryNames],
  )

  const pendingItems   = displayItems.filter(i => !decisions.has(i.key))
  const confirmedItems = displayItems.filter(i => decisions.get(i.key) === 'confirmed')
  const ignoredItems   = displayItems.filter(i => decisions.get(i.key) === 'ignored')

  // Cartões & Parcelas conta sempre como fixo, sem precisar de confirmação manual
  const installmentsMonthly = installments.reduce((s, i) => s + i.monthlyAmount, 0)
  // "Despesas fixas / mês" é só o lado da despesa — recorrência também detecta
  // receita e transferência agora, mas esse número de resumo é especificamente de gasto.
  const confirmedDespesaItems = confirmedItems.filter(i => i.type === 'despesa')
  const totalMonthly = confirmedDespesaItems.reduce((s, i) => s + i.avgAmount, 0) + installmentsMonthly
  // Receita não entra em nenhum total de gasto — é só pra exibir o resumo aqui em cima.
  const confirmedReceitaItems = confirmedItems.filter(i => i.type === 'receita')
  const receitaMonthly = confirmedReceitaItems.reduce((s, i) => s + i.avgAmount, 0)

  // Sincroniza transações novas (ex: de uma importação recente) com o estado que
  // o grupo já tem — is_recurring e subcategoria. Sem isso, uma transação recém
  // importada com a mesma descrição de um item já confirmado/rotulado ficava para
  // trás: o item já parecia "is_recurring: true" no agregado (por causa de
  // ocorrências antigas), então a sincronização antiga nunca tocava na nova linha.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (loading || decisionsLoading || displayItems.length === 0 || syncedRef.current) return
    syncedRef.current = true

    async function sync() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Propaga is_recurring=true para TODAS as descrições de itens confirmados
      // (idempotente — rodar de novo em quem já é true não muda nada; nunca reverte).
      const confirmedDescriptions = displayItems
        .filter(item => decisions.get(item.key) === 'confirmed')
        .flatMap(item => item.descriptions)
      if (confirmedDescriptions.length > 0) {
        await supabase.from('transactions')
          .update({ is_recurring: true })
          .eq('user_id', user.id)
          .in('description', confirmedDescriptions)
      }

      if (confirmedDescriptions.length > 0) refetchRecurring()
    }

    sync()
  }, [loading, decisionsLoading, displayItems.length]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm(item: DisplayItem) {
    setDecision(item.key, 'confirmed')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: true })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  async function handleIgnore(item: DisplayItem) {
    setDecision(item.key, 'ignored')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: false })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  async function handleUndo(item: DisplayItem) {
    setDecision(item.key, null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('transactions')
        .update({ is_recurring: false })
        .eq('user_id', user.id)
        .in('description', item.descriptions)
      refetchRecurring()
    }
  }

  const isLoading = loading || decisionsLoading

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const rowHandlers = (item: DisplayItem) => ({
    onConfirm: () => handleConfirm(item),
    onIgnore: () => handleIgnore(item),
    onUndo: () => handleUndo(item),
  })

  // Confirmados organizados como na tela de Categorias: Categoria › Subcategoria.
  // Uma subcategoria já chega como item agrupado; descrição solta fica sob a
  // categoria-mãe em que está.
  function byMother(items: DisplayItem[]) {
    const map = new Map<string, DisplayItem[]>()
    for (const item of items) {
      const mother = motherOf(item.category, mothers, item.type)
      const list = map.get(mother) ?? []
      list.push(item)
      map.set(mother, list)
    }
    return [...map.entries()]
      .map(([name, list]) => ({
        name,
        items: list.sort((x, y) => y.avgAmount - x.avgAmount),
        total: list.reduce((sum, i) => sum + i.avgAmount, 0),
      }))
      .sort((x, y) => y.total - x.total)
  }

  const today = new Date()
  // Cor e ícone da categoria-mãe do tipo certo — os mesmos de Categorias e Análise.
  function styleOf(name: string, type: 'despesa' | 'receita') {
    const same = categories.filter(c => !c.parent_id && c.name === name)
    const mother = same.find(c => c.type === type) ?? same.find(c => c.type === 'ambos') ?? same[0]
    return {
      color: mother?.color ?? categoryColor(name),
      iconKey: mother ? categoryIconKey(mother, categories) : guessIconKey(name),
    }
  }
  const despesaGroups: CategoryGroup[] = byMother(confirmedDespesaItems).map(g => ({ ...g, ...styleOf(g.name, 'despesa') }))
  const receitaGroups: CategoryGroup[] = byMother(confirmedReceitaItems).map(g => ({ ...g, ...styleOf(g.name, 'receita') }))
  // Para a barra "Para onde vai": parcelas entram como uma fatia própria.
  const splitGroups: CategoryGroup[] = [
    ...despesaGroups,
    ...(installments.length > 0 ? [{ name: 'Cartões & Parcelas', color: PARCELAS_COLOR, iconKey: 'card', items: [], total: installmentsMonthly }] : []),
  ].sort((x, y) => y.total - x.total)

  const renderTypeSection = ({ type, label, icon: Icon, iconColor, totalColor, help }: typeof TYPE_SECTIONS[number]) => {
    const typeConfirmed = type === 'despesa' ? confirmedDespesaItems : confirmedReceitaItems
    const typeIgnored   = ignoredItems.filter(i => i.type === type)
    const showInstallments = type === 'despesa' && installments.length > 0
    const typeConfirmedTotal = type === 'despesa' ? totalMonthly : receitaMonthly

    if (typeConfirmed.length === 0 && typeIgnored.length === 0 && !showInstallments) {
      return null
    }

    return (
      <section key={type} className="space-y-3">
        {typeConfirmed.length === 0 && !showInstallments ? (
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4', iconColor)} />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{label} fixas</h2>
            <span className="text-sm text-slate-400">· nada confirmado ainda</span>
          </div>
        ) : (
          <FixedCategoryCard
            title={`${label} fixas por categoria`}
            subtitle={help}
            icon={Icon}
            iconClass={iconColor}
            groups={type === 'despesa' ? despesaGroups : receitaGroups}
            total={typeConfirmedTotal}
            totalLabel={`Total de ${label.toLowerCase()} fixas`}
            totalClass={totalColor}
            installments={showInstallments ? installments : undefined}
            today={today}
            onUndo={handleUndo}
          />
        )}

        {typeIgnored.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => toggleIgnored(type)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              {showIgnored.has(type) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showIgnored.has(type) ? 'Ocultar ignorados' : `Ver ${typeIgnored.length} ignorado${typeIgnored.length !== 1 ? 's' : ''}`}
            </button>
            {showIgnored.has(type) && (
              <div className="space-y-2 mt-3 opacity-60">
                {typeIgnored.map(item => (
                  <div key={item.key} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{item.name}</p>
                      <p className="text-xs text-slate-400">{fmt(item.avgAmount)} · {item.monthsCount}x</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-slate-600"
                      onClick={() => setDecision(item.key, null)}>
                      Restaurar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  const despesaCount = confirmedDespesaItems.length + (installments.length > 0 ? 1 : 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Recorrências</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Receitas e despesas fixas detectadas nos últimos 12 meses
          </p>
        </div>
        <Link
          href="/settings/categories"
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          <Tag className="h-4 w-4" />
          Categorias
        </Link>
      </div>

      {recurring.length === 0 && installments.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          iconColor="text-sky-500"
          iconBg="bg-sky-50 dark:bg-sky-500/15"
          title="Nenhuma cobrança fixa detectada"
          description="O app detecta automaticamente receitas e despesas que se repetem em 2 ou mais meses consecutivos."
          primaryLabel="Importar extrato"
          primaryHref="/transactions"
          secondaryLabel="Como funciona"
          secondaryHref="/help"
        />
      ) : (
        <>
          <RecurringSummary
            despesa={totalMonthly}
            receita={receitaMonthly}
            despesaCount={despesaCount}
            receitaCount={confirmedReceitaItems.length}
          />

          <div className="grid gap-4 lg:grid-cols-2 items-stretch">
            <IncomeSplit groups={splitGroups} despesa={totalMonthly} receita={receitaMonthly} />
            <MonthCalendar despesas={confirmedDespesaItems} receitas={confirmedReceitaItems} installments={installments} />
          </div>
        </>
      )}

      {/* Para revisar — detectado, ainda sem decisão. Confirmar leva o item
          para a tabela de categorias lá embaixo. */}
      {pendingItems.length > 0 && (
        <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2 px-3 pt-1 pb-1">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Para revisar</p>
            <span className="text-xs text-slate-400">({pendingItems.length}) — apareceram em 2+ meses seguidos</span>
          </div>
          {[...pendingItems]
            .sort((x, y) => (x.type === y.type ? 0 : x.type === 'despesa' ? -1 : 1) || y.avgAmount - x.avgAmount)
            .map(item => (
              <ItemRow
                key={item.key}
                item={item}
                pending
                label={item.name}
                sublabel={categoryPath(item.isGroup ? (item.subcategory ?? item.category) : item.category)}
                {...rowHandlers(item)}
              />
            ))}
        </section>
      )}

      <MissingAlert items={confirmedItems} today={today} />

      {/* Despesas e Receitas lado a lado; se só uma tiver conteúdo, ocupa a linha toda. */}
      {(() => {
        const sections = TYPE_SECTIONS.map(renderTypeSection).filter(Boolean)
        return (
          <div className={cn('grid gap-4 items-start', sections.length > 1 && 'lg:grid-cols-2')}>
            {sections}
          </div>
        )
      })()}

      <RecurringHelp />
    </div>
  )
}

export default withPlan(
  'recurring',
  FixosPage,
  'O app encontra sozinho seus gastos fixos dos últimos 12 meses e mostra quanto da sua renda já está comprometida antes do mês começar.',
)
