'use client'

import { withPlan } from '@/components/plan/with-plan'

import { useState, useMemo, useEffect } from 'react'
import { useRules, CategorizationRule, applyRuleToExisting, isInternalRule, matchesRule } from '@/hooks/use-rules'
import { useTransactions } from '@/hooks/use-transactions'
import Link from 'next/link'
import { CategoryRulesList, type RuleFilter } from '@/components/rules/category-rules-list'
import { AportesRulesTab } from '@/components/rules/aportes-rules-tab'
import { RuleKindIntro, type RuleKind } from '@/components/rules/rule-kind-intro'
import { RulesHelp } from '@/components/rules/rules-help'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { InternalRulesSection } from '@/components/rules/internal-rules-section'
import { useCategories } from '@/hooks/use-categories'
import { CategoryOptions } from '@/components/categories/category-options'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { CategoryType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Zap, CheckCircle2, X, AlertCircle, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'

type MatchType = 'contains' | 'starts_with' | 'ends_with' | 'exact'
// Tipo é só um filtro client-side pra achar a categoria certa mais rápido — a
// regra em si não grava tipo nenhum, o tipo efetivo dela é sempre o da
// categoria que ela aponta.
type RuleTypeFilter = 'despesa' | 'receita'

interface FormState {
  keyword: string
  matchType: MatchType
  type: RuleTypeFilter
  category: string
  board_id: string
}

const EMPTY: FormState = { keyword: '', matchType: 'contains', type: 'despesa', category: '', board_id: '' }

const RULE_TYPE_OPTIONS: { value: RuleTypeFilter; label: string }[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
]

const MATCH_LABELS: Record<MatchType, string> = {
  contains:    'Contém',
  starts_with: 'Começa com',
  ends_with:   'Termina com',
  exact:       'Igual a',
}

type RetroResult = { count: number; keyword: string; schemaWarning?: boolean; error?: string }

function RulesPage() {
  const { rules: allRules, loading, createRule, updateRule, deleteRule } = useRules()
  // Regras "Entre minhas contas" têm seção própria — não têm categoria, então
  // não entram no agrupamento por categoria abaixo.
  const rules = useMemo(() => allRules.filter(r => !isInternalRule(r)), [allRules])
  const internalRules = useMemo(() => allRules.filter(isInternalRule), [allRules])
  const { categories } = useCategories()
  const { boards, updateBoard } = useTransactionBoards()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategorizationRule | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState<CategorizationRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [retroResult, setRetroResult] = useState<RetroResult | null>(null)
  const [tab, setTab] = useState<RuleKind>('categorias')
  const [ruleFilter, setRuleFilter] = useState<RuleFilter>('all')
  const [testText, setTestText] = useState('')
  const { transactions, loading: txLoading, refetch: refetchTransactions } = useTransactions()

  const boardMap = useMemo(() => {
    const m: Record<string, string> = {}
    boards.forEach(b => { m[b.id] = b.name })
    return m
  }, [boards])

  const categoryTypeMap = useMemo(() => {
    const m = new Map<string, CategoryType>()
    categories.forEach(c => m.set(c.name, c.type))
    return m
  }, [categories])

  function openCreate(category = '') {
    const t = categoryTypeMap.get(category)
    setEditing(null)
    setForm({ ...EMPTY, category, type: t === 'receita' ? 'receita' : 'despesa' })
    setFormOpen(true)
  }
  function openEdit(r: CategorizationRule) {
    const ext = r as CategorizationRule & { match_type?: MatchType; board_id?: string }
    // Categoria "Ambos" (ex: Outros) vale pros 3 tipos — nesse caso não tem
    // como saber qual Tipo o usuário tinha em mente, então cai em "despesa"
    // por padrão (a categoria continua aparecendo, "ambos" bate com qualquer filtro).
    const existingType = categoryTypeMap.get(r.category)
    setEditing(r)
    setForm({
      keyword: r.keyword,
      matchType: ext.match_type ?? 'contains',
      type: existingType === 'receita' || existingType === 'despesa' ? existingType : 'despesa',
      category: r.category,
      board_id: ext.board_id ?? '',
    })
    setFormOpen(true)
  }

  // Categorias normais e isoladas ficam em seletores separados (mesmo padrão do
  // formulário de transação) — escolher em um desmarca o outro. Sem filtro de
  // data aqui: regra não é presa a uma transação específica, então qualquer
  // categoria isolada do tipo certo é uma opção válida (a checagem de mês só
  // acontece depois, transação por transação, quando a regra é aplicada).
  const typeFilteredCategories = useMemo(
    () => categories.filter(c => c.type === form.type || c.type === 'ambos'),
    [categories, form.type],
  )
  const normalCategoryOptions = typeFilteredCategories.filter(c => !c.special_dates || c.special_dates.length === 0)

  // Se o Tipo mudar e a categoria escolhida não fizer mais sentido pra ele, limpa.
  useEffect(() => {
    if (!form.category) return
    const stillValid = typeFilteredCategories.some(c => c.name === form.category)
    if (!stillValid) setForm(f => ({ ...f, category: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setRetroResult(null)
    const keyword = form.keyword.trim()
    const payload = {
      keyword,
      category: form.category,
      match_type: form.matchType,
      board_id: form.board_id || null,
    }

    let schemaWarning = false

    if (editing) {
      const result = await updateRule(editing.id, payload as Parameters<typeof updateRule>[1])
      if (!result.ok) {
        setSaving(false)
        setRetroResult({ count: -1, keyword }) // -1 = erro fatal
        setFormOpen(false)
        return
      }
      if (result.error === 'partial') schemaWarning = true
    } else {
      await createRule(keyword, form.category, payload as Parameters<typeof createRule>[2])
    }

    const { count, error: retroError } = await applyRuleToExisting(payload, categories)
    setSaving(false)
    setFormOpen(false)
    setRetroResult({ count, keyword, schemaWarning, error: retroError })
  }

  // ── Números por regra, conflitos e o que falta revisar ──
  const ruleUses = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rules) m.set(r.id, transactions.filter(t => matchesRule(t.description, r)).length)
    return m
  }, [rules, transactions])
  const conflicts = useMemo(() => {
    // Uma regra cuja palavra está dentro da palavra de outra, com categoria
    // diferente: a criada primeiro "engole" os lançamentos da outra.
    const ids = new Set<string>()
    const pairs: [CategorizationRule, CategorizationRule][] = []
    const act = rules.filter(r => r.active)
    for (const a of act) {
      const mt = (a as CategorizationRule & { match_type?: MatchType }).match_type ?? 'contains'
      if (mt === 'exact') continue
      const ka = a.keyword.trim().toUpperCase()
      if (ka.length < 2) continue
      for (const b of act) {
        if (a.id === b.id || a.category === b.category) continue
        const kb = b.keyword.trim().toUpperCase()
        if (kb !== ka && kb.includes(ka)) { ids.add(a.id); ids.add(b.id); pairs.push([a, b]) }
      }
    }
    return { ids, pairs }
  }, [rules])
  // Enquanto os lançamentos carregam, toda regra pareceria "não pega nada".
  const zeroCount = txLoading ? 0 : rules.filter(r => r.active && (ruleUses.get(r.id) ?? 0) === 0).length
  const outrosSemRegra = useMemo(
    () => txLoading ? 0 : transactions.filter(t => t.type === 'despesa' && (t.category ?? '').toLowerCase() === 'outros' && !rules.some(r => r.active && matchesRule(t.description, r))).length,
    [transactions, rules, txLoading],
  )
  const autoCount = rules.filter(r => r.auto_created).length

  // Entre minhas contas × Aportes: o destino decide.
  const investmentIds = useMemo(() => new Set(boards.filter(b => b.is_investment).map(b => b.id)), [boards])
  const aporteRules = internalRules.filter(r => r.target_board_id && investmentIds.has(r.target_board_id))
  const entreRules = internalRules.filter(r => !(r.target_board_id && investmentIds.has(r.target_board_id)))

  function goFilter(f: RuleFilter) {
    setTab('categorias')
    setSearch('')
    setRuleFilter(f)
  }

  // Testar uma descrição: o que cada tipo de regra faria com ela.
  const test = useMemo(() => {
    const d = testText.trim()
    if (d.length < 2) return null
    const cat = rules.filter(r => r.active && matchesRule(d, r))
    const internal = internalRules.filter(r => r.active && matchesRule(d, r))
    return { first: cat[0] ?? null, others: cat.slice(1), internal }
  }, [testText, rules, internalRules])

  const tabs: { key: RuleKind; label: string; count: number }[] = [
    { key: 'categorias', label: 'Categorias', count: rules.length },
    { key: 'entre', label: 'Entre minhas contas', count: entreRules.length },
    { key: 'aportes', label: 'Aportes', count: aporteRules.length },
  ]

  if (loading) return null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">Regras automáticas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {rules.length} de categoria ({autoCount} criadas sozinhas) · {entreRules.length} entre minhas contas · {aporteRules.length} de aporte
          </p>
        </div>
        {tab === 'categorias' && (
          <Button onClick={() => openCreate()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )}
      </div>

      {/* Abas: três tipos de regra, cada um explicado */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700')}>
            {t.label} · {t.count}
          </button>
        ))}
      </div>

      {/* Retroactive result banner */}
      {retroResult && retroResult.count === -1 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <X className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Erro ao salvar</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Não foi possível salvar a regra. Execute a migration <strong>migration_rules.sql</strong> no SQL Editor do Supabase e tente novamente.
            </p>
          </div>
          <button onClick={() => setRetroResult(null)} className="text-red-400 hover:text-red-600 transition-colors"><X className="h-4 w-4" /></button>
        </div>
      )}
      {retroResult && retroResult.count !== -1 && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${
          retroResult.error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : retroResult.schemaWarning ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        }`}>
          {retroResult.error
            ? <X className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            : <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${retroResult.schemaWarning ? 'text-amber-500' : 'text-emerald-500'}`} />
          }
          <div className="flex-1">
            <p className={`text-sm font-semibold ${
              retroResult.error ? 'text-red-800 dark:text-red-300'
              : retroResult.schemaWarning ? 'text-amber-800 dark:text-amber-300'
              : 'text-emerald-800 dark:text-emerald-300'
            }`}>
              {retroResult.error ? 'Regra salva, mas o histórico não foi atualizado' : retroResult.schemaWarning ? 'Regra salva parcialmente' : 'Regra salva!'}
            </p>
            <p className={`text-xs mt-0.5 ${
              retroResult.error ? 'text-red-600 dark:text-red-400'
              : retroResult.schemaWarning ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {retroResult.error
                ? retroResult.error
                : retroResult.schemaWarning
                  ? 'Categoria e palavra-chave foram salvas. Para salvar o tipo de correspondência e conta, execute migration_rules.sql no SQL Editor do Supabase.'
                  : retroResult.count > 0
                    ? `${retroResult.count} transação${retroResult.count !== 1 ? 'ões' : ''} anterior${retroResult.count !== 1 ? 'es' : ''} atualizada${retroResult.count !== 1 ? 's' : ''} com a categoria correta.`
                    : `Nenhuma transação anterior encontrada para "${retroResult.keyword}".`}
            </p>
          </div>
          <button onClick={() => setRetroResult(null)} className={`transition-colors ${retroResult.schemaWarning ? 'text-amber-400 hover:text-amber-600' : 'text-emerald-400 hover:text-emerald-600'}`}><X className="h-4 w-4" /></button>
        </div>
      )}


      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-4 min-w-0">
          <RuleKindIntro kind={tab} />

          {tab === 'categorias' && (rules.length === 0 ? (
            <EmptyState
              icon={Zap}
              iconColor="text-amber-500"
              iconBg="bg-amber-50 dark:bg-amber-500/15"
              title="Nenhuma regra criada"
              description="Regras automatizam a categorização das suas importações. Ex: tudo que contém 'UBER' vai para Transporte."
              primaryLabel="Criar primeira regra"
              primaryOnClick={() => openCreate()}
              secondaryLabel="Ver ajuda"
              secondaryHref="/help"
            />
          ) : (
            <CategoryRulesList
              rules={rules}
              categories={categories}
              uses={ruleUses}
              usesLoading={txLoading}
              conflictIds={conflicts.ids}
              filter={ruleFilter}
              onFilter={setRuleFilter}
              search={search}
              onSearch={setSearch}
              boardMap={boardMap}
              onToggle={r => updateRule(r.id, { active: !r.active })}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onCreateIn={c => openCreate(c)}
            />
          ))}

          {tab === 'entre' && (
            <InternalRulesSection
              rules={entreRules}
              boards={boards}
              createRule={createRule}
              updateRule={updateRule}
              deleteRule={deleteRule}
            />
          )}

          {tab === 'aportes' && (
            <AportesRulesTab
              boards={boards}
              rules={allRules}
              transactions={transactions}
              createRule={createRule}
              updateRule={updateRule}
              updateBoard={updateBoard}
              onDelete={setDeleteTarget}
              onChanged={refetchTransactions}
            />
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          {(zeroCount > 0 || conflicts.pairs.length > 0 || outrosSemRegra > 0) && (
            <section className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vale revisar</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">Deixa a categorização da importação mais certa</p>
              <ul className="mt-2 divide-y divide-amber-200/70 dark:divide-amber-800/40">
                {zeroCount > 0 && (
                  <li className="flex items-start gap-3 py-2.5">
                    <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{zeroCount} regra{zeroCount === 1 ? '' : 's'} não pega{zeroCount === 1 ? '' : 'm'} nenhum lançamento</p>
                      <p className="mt-0.5 leading-relaxed">Palavra digitada errada ou loja que mudou de nome.</p>
                    </div>
                    <button type="button" onClick={() => goFilter('zero')} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Ver</button>
                  </li>
                )}
                {conflicts.pairs.length > 0 && (
                  <li className="flex items-start gap-3 py-2.5">
                    <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{conflicts.ids.size} regras em conflito</p>
                      <p className="mt-0.5 leading-relaxed">
                        &ldquo;{conflicts.pairs[0][0].keyword}&rdquo; ({conflicts.pairs[0][0].category}) também pega &ldquo;{conflicts.pairs[0][1].keyword}&rdquo; ({conflicts.pairs[0][1].category}).
                      </p>
                    </div>
                    <button type="button" onClick={() => goFilter('conflict')} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Ver</button>
                  </li>
                )}
                {outrosSemRegra > 0 && (
                  <li className="flex items-start gap-3 py-2.5">
                    <div className="flex-1 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{outrosSemRegra} lançamento{outrosSemRegra === 1 ? '' : 's'} em &ldquo;Outros&rdquo; sem regra</p>
                      <p className="mt-0.5 leading-relaxed">Categorize por descrição e a regra nasce sozinha.</p>
                    </div>
                    <Link href="/settings/categories?revisar=outros" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0">Revisar</Link>
                  </li>
                )}
              </ul>
            </section>
          )}

          <OverviewSection icon={FlaskConical} iconClass="text-green-600" title="Testar uma descrição" subtitle="Veja o que cada tipo de regra faria na importação">
            <Input
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder="Ex: UBER EATS *PEDIDO 4471"
              className="mt-3 font-mono text-sm"
            />
            {test && (
              <div className="mt-3 space-y-2 text-xs">
                <div className={cn('rounded-lg border px-3 py-2',
                  test.first ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                    : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500')}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Categoria</p>
                  {test.first ? (
                    <>
                      <p className="font-semibold text-sm">→ {test.first.category}</p>
                      <p>pela regra &ldquo;{test.first.keyword}&rdquo; · {test.first.auto_created ? 'automática' : 'manual'}</p>
                      {test.others.length > 0 && (
                        <p className="text-slate-500 mt-1">Também combinaria: {test.others.slice(0, 3).map(o => `"${o.keyword}" → ${o.category}`).join(', ')}</p>
                      )}
                    </>
                  ) : <p>Nenhuma regra de categoria — o app tenta pelo histórico ou deixa em &ldquo;Outros&rdquo;.</p>}
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-slate-600 dark:text-slate-300">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Entre minhas contas / Aporte</p>
                  {test.internal.length > 0 ? test.internal.slice(0, 3).map(r => {
                    const isAporte = !!r.target_board_id && investmentIds.has(r.target_board_id)
                    return (
                      <p key={r.id} className="mt-0.5">
                        <strong>{isAporte ? `Aporte em ${boardMap[r.target_board_id!] ?? 'investimento'}` : 'Entre minhas contas'}</strong>
                        {' '}pela regra &ldquo;{r.keyword}&rdquo;{r.scope_board_id ? ` (só na conta ${boardMap[r.scope_board_id] ?? ''})` : ''}
                      </p>
                    )
                  }) : <p className="mt-0.5">Nenhuma — conta como gasto ou receita normal.</p>}
                </div>
              </div>
            )}
          </OverviewSection>
        </div>
      </div>

      <RulesHelp />

      {/* Form Modal */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) setFormOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">

            {/* Condição */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Condição</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-match" className="text-xs">Tipo de correspondência</Label>
                  <Select value={form.matchType} onValueChange={v => setForm(f => ({ ...f, matchType: v as MatchType }))} items={MATCH_LABELS}>
                    <SelectTrigger id="rule-match" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(MATCH_LABELS) as [MatchType, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-keyword" className="text-xs">Texto</Label>
                  <Input
                    id="rule-keyword"
                    placeholder="Ex: IFOOD, UBER..."
                    value={form.keyword}
                    onChange={e => setForm(f => ({ ...f, keyword: e.target.value.toUpperCase() }))}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">Sem distinção de maiúsculas/minúsculas</p>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-700" />

            {/* Ações */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</Label>

              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  {RULE_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.type === opt.value
                          ? opt.value === 'receita'
                            ? 'bg-green-600 text-white border-green-600'
                            : opt.value === 'despesa'
                              ? 'bg-red-500 text-white border-red-500'
                              : 'bg-slate-500 text-white border-slate-500'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Definir categoria</Label>
                <Select value={form.category} onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}>
                  <SelectTrigger id="rule-category" className="w-full">
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <CategoryOptions list={normalCategoryOptions} all={categories} />
                  </SelectContent>
                </Select>
              </div>

              {boards.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-board" className="text-xs">Mover para conta (opcional)</Label>
                  <Select value={form.board_id} onValueChange={v => setForm(f => ({ ...f, board_id: v ?? '' }))} items={{ '': 'Nenhuma conta específica', ...boardMap }}>
                    <SelectTrigger id="rule-board" className="w-full">
                      <SelectValue placeholder="Nenhuma conta específica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma conta específica</SelectItem>
                      {boards.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={!form.keyword || !form.category || saving} className="flex-1">
                {saving ? 'Aplicando...' : editing ? 'Salvar e corrigir histórico' : 'Criar regra'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir regra</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400 pt-2">
            Excluir a regra <strong>&ldquo;{deleteTarget?.keyword}&rdquo;</strong>? Importações futuras não serão afetadas por ela.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button variant="destructive" onClick={() => { deleteRule(deleteTarget!.id); setDeleteTarget(null) }} className="flex-1">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withPlan(
  'rules',
  RulesPage,
  'As regras categorizam sozinhas tudo que se repete no seu extrato — você arruma uma vez e nunca mais.',
)
