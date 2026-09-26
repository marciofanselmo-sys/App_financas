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
  RefreshCw, CheckCircle, EyeOff, Eye, AlertCircle, Clock,
  Layers, Tag, ChevronDown, CreditCard, ArrowRight,
  TrendingDown, TrendingUp, } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { InfoBox } from '@/components/ui/info-box'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function formatDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

// ── Card de item ──────────────────────────────────────────────────────────────
function ItemCard({
  item, decision, categoryPath, categoryColor, onConfirm, onIgnore, onUndo,
}: {
  item: DisplayItem
  decision: 'confirmed' | 'ignored' | null
  /** "Moradia › Aluguel" — o caminho da categoria do item. */
  categoryPath: (name: string) => string
  categoryColor: (name: string) => string
  onConfirm: () => void
  onIgnore: () => void
  onUndo: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isPending = decision === null
  const borderCls = item.isGroup
    ? 'border-violet-200 dark:border-violet-800/50'
    : isPending
      ? 'border-amber-200 dark:border-amber-800/40'
      : 'border-emerald-200 dark:border-emerald-800/40'

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 rounded-2xl border shadow-sm p-4 group',
        item.isGroup && 'cursor-pointer',
        borderCls
      )}
      onClick={item.isGroup ? () => setExpanded(v => !v) : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex items-start gap-3 flex-1">
          <div className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
            item.isGroup
              ? 'bg-violet-50 dark:bg-violet-900/30'
              : isPending
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-emerald-50 dark:bg-emerald-900/30'
          )}>
            {item.isGroup
              ? <Layers className="h-4 w-4 text-violet-500" />
              : isPending
                ? <Clock className="h-4 w-4 text-amber-500" />
                : <CheckCircle className="h-4 w-4 text-emerald-500" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{item.name}</p>

            {/* Caminho da categoria. O agrupamento agora vem da própria
                subcategoria: para mudar, é só trocar a categoria do
                lançamento em Contas e Cartões. */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                <Tag className="h-2.5 w-2.5" />
                {categoryPath(item.isGroup ? (item.subcategory ?? item.category) : item.category)}
              </span>
              {item.isGroup && (
                <span className="flex items-center gap-0.5 text-xs text-slate-400">
                  · {item.descriptions.length} descrições
                  <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                </span>
              )}
            </div>

            {item.isGroup && expanded && (
              <div className="mt-2 space-y-0.5">
                {item.descriptions.map(d => (
                  <p key={d} className="text-xs text-slate-400 dark:text-slate-500 truncate">• {d}</p>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />{item.monthsCount}x detectado
              </span>
              <span className="text-xs text-slate-400">última: {formatDate(item.lastDate)}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmt(item.avgAmount)}</p>
          <p className="text-xs text-slate-400">média/mês</p>
          {!isPending && item.isGroup && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onUndo() }}
              title="Desfazer confirmação"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <RefreshCw className="h-3 w-3" /> Desfazer
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        {isPending ? (
          <>
            <Button size="sm" variant="outline"
              className="flex-1 h-8 text-xs gap-1.5 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={onConfirm}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirmar como fixo
            </Button>
            <Button size="sm" variant="ghost"
              className="h-8 text-xs gap-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={onIgnore}>
              <EyeOff className="h-3.5 w-3.5" /> Ignorar
            </Button>
          </>
        ) : item.isGroup ? (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: categoryColor(item.subcategory ?? item.category) }}
            />
            {categoryPath(item.subcategory ?? item.category)}
          </span>
        ) : (
          <Button size="sm" variant="ghost"
            className="h-8 text-xs gap-1.5 text-slate-400 hover:text-slate-600"
            onClick={onUndo}>
            <RefreshCw className="h-3 w-3" /> Desfazer confirmação
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Metadados de cada seção por tipo ────────────────────────────────────────────
const TYPE_SECTIONS: {
  type: TransactionType
  label: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  totalColor: string
  help: string
}[] = [
  {
    type: 'despesa', label: 'Despesas', icon: TrendingDown, iconColor: 'text-red-500', iconBg: 'bg-red-50 dark:bg-red-900/20', totalColor: 'text-red-500',
    help: 'Cobranças que se repetem todo mês (assinaturas, contas fixas). Confirmar aqui alimenta o total "Despesas fixas / mês" e o campo "Gastos Previstos" do Planejamento.',
  },
  {
    type: 'receita', label: 'Receitas', icon: TrendingUp, iconColor: 'text-green-500', iconBg: 'bg-green-50 dark:bg-green-900/20', totalColor: 'text-green-600',
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

  const [installmentsExpanded, setInstallmentsExpanded] = useState(false)


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
      <div className="space-y-4 max-w-3xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const renderCards = (items: DisplayItem[], decision: 'confirmed' | 'ignored' | null) =>
    items.map(item => (
      <ItemCard
        key={item.key}
        item={item}
        decision={decision}
        categoryPath={categoryPath}
        categoryColor={categoryColor}
        onConfirm={() => handleConfirm(item)}
        onIgnore={() => handleIgnore(item)}
        onUndo={() => handleUndo(item)}
      />
    ))

  const renderTypeSection = ({ type, label, icon: Icon, iconColor, iconBg, totalColor, help }: typeof TYPE_SECTIONS[number]) => {
    const typePending   = pendingItems.filter(i => i.type === type)
    const typeConfirmed = confirmedItems.filter(i => i.type === type)
    const typeIgnored   = ignoredItems.filter(i => i.type === type)
    const showInstallments = type === 'despesa' && installments.length > 0
    const typeConfirmedTotal = typeConfirmed.reduce((s, i) => s + i.avgAmount, 0) + (type === 'despesa' ? installmentsMonthly : 0)

    if (typePending.length === 0 && typeConfirmed.length === 0 && typeIgnored.length === 0 && !showInstallments) {
      return null
    }

    return (
      <section key={type} className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconBg)}>
              <Icon className={cn('h-4 w-4', iconColor)} />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{label}</h2>
            {typeConfirmedTotal > 0 && (
              <span className={cn('text-sm font-semibold ml-auto', totalColor)}>{fmt(typeConfirmedTotal)}/mês</span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-9">{help}</p>
        </div>

        {/* Cartões & Parcelas — sempre conta como fixo, atualizado automaticamente */}
        {showInstallments && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cartões & Parcelas</p>
              <span className="text-xs text-slate-400">(sempre fixo)</span>
            </div>

            <div
              className="bg-white dark:bg-slate-800 rounded-2xl border border-violet-200 dark:border-violet-800/50 shadow-sm p-4 cursor-pointer"
              onClick={() => setInstallmentsExpanded(v => !v)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex items-start gap-3 flex-1">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-violet-50 dark:bg-violet-900/30">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Parcelamentos ativos este mês</p>
                    {installmentsExpanded && (
                      <div className="mt-2 space-y-0.5">
                        {installments.map(item => (
                          <p key={item.description} className="text-xs text-slate-400 dark:text-slate-500 truncate">
                            • {item.description} ({item.currentInstallment}/{item.totalInstallments}) — {fmt(item.monthlyAmount)}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />{installments.length} ativo{installments.length !== 1 ? 's' : ''}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', installmentsExpanded && 'rotate-180')} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{fmt(installmentsMonthly)}</p>
                  <p className="text-xs text-slate-400">por mês</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <Link
                  href="/recurring"
                  className="flex-1 h-8 text-xs gap-1.5 inline-flex items-center justify-center rounded-lg border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                >
                  Ver em Cartões & Parcelas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {typePending.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aguardando revisão</p>
              <span className="text-xs text-slate-400">({typePending.length})</span>
            </div>
            {renderCards(typePending, null)}
          </div>
        )}

        {typeConfirmed.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Confirmados como fixos</p>
              <span className="text-xs text-slate-400">({typeConfirmed.length})</span>
            </div>
            {renderCards(typeConfirmed, 'confirmed')}
          </div>
        )}

        {typeIgnored.length > 0 && (
          <div className="pt-2">
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

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Recorrências</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Receitas e despesas fixas detectadas nos últimos 12 meses — organizadas por tipo, cada uma com sua própria categoria
          </p>
        </div>
        <Link
          href="/settings/subcategories"
          className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
        >
          <Tag className="h-4 w-4" />
          Subcategorias
        </Link>
      </div>

      {/* Explicação — essa tela tem bastante lógica não óbvia por trás */}
      <InfoBox id="fixos-como-funciona">
        <p className="text-blue-600 dark:text-blue-400">
          O app detecta sozinho qualquer descrição que se repete em 2 ou mais meses seguidos e mostra como &ldquo;Aguardando revisão&rdquo;. Ao clicar em <strong>Confirmar como fixo</strong>, todas as transações passadas com essa descrição são marcadas como recorrentes — e futuras importações da mesma descrição já entram marcadas, sem precisar confirmar de novo. <strong>Ignorar</strong> só tira da lista de pendentes (dá pra restaurar depois); não apaga nem altera a transação além disso.
        </p>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">Por que três seções?</p>
          <p className="text-blue-600 dark:text-blue-400">
            Receita e despesa têm naturezas diferentes, então cada uma tem sua própria lista de pendentes/confirmados/ignorados. Só o lado de <strong>Despesas</strong> entra no número &ldquo;Despesas fixas / mês&rdquo; aqui em cima e no campo &ldquo;Gastos Previstos&rdquo; do Planejamento — confirmar uma receita fixa não afeta esses totais, é só pra você identificar o padrão.
          </p>
        </div>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Cartões & Parcelas sempre conta
          </p>
          <p className="text-blue-600 dark:text-blue-400">
            Parcelamentos ativos aparecem direto dentro de Despesas, sem precisar confirmar — uma compra parcelada já é, por natureza, uma cobrança garantida nos próximos meses.
          </p>
        </div>
      </InfoBox>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Despesa fixa / mês</p>
          <p className="text-xl font-bold text-red-500 mt-1">{fmt(totalMonthly)}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {confirmedDespesaItems.length + (installments.length > 0 ? 1 : 0)} item{(confirmedDespesaItems.length + (installments.length > 0 ? 1 : 0)) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Receita fixa / mês</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{fmt(receitaMonthly)}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {confirmedReceitaItems.length} item{confirmedReceitaItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {recurring.length === 0 && (
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
      )}

      {TYPE_SECTIONS.map(renderTypeSection)}
    </div>
  )
}

export default withPlan(
  'recurring',
  FixosPage,
  'O app encontra sozinho seus gastos fixos dos últimos 12 meses e mostra quanto da sua renda já está comprometida antes do mês começar.',
)
