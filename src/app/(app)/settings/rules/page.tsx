'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRules, CategorizationRule, applyRuleToExisting } from '@/hooks/use-rules'
import { useCategories } from '@/hooks/use-categories'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { CategoryType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, CheckCircle2, X,
  TrendingDown, TrendingUp, ArrowLeftRight, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { InfoBox } from '@/components/ui/info-box'

type MatchType = 'contains' | 'starts_with' | 'ends_with' | 'exact'
// Tipo é só um filtro client-side pra achar a categoria certa mais rápido — a
// regra em si não grava tipo nenhum, o tipo efetivo dela é sempre o da
// categoria que ela aponta.
type RuleTypeFilter = 'despesa' | 'receita' | 'transferencia'

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
  { value: 'transferencia', label: 'Transferência' },
]

const MATCH_LABELS: Record<MatchType, string> = {
  contains:    'Contém',
  starts_with: 'Começa com',
  ends_with:   'Termina com',
  exact:       'Igual a',
}

function matchDescription(rule: CategorizationRule): string {
  const mt = (rule as CategorizationRule & { match_type?: MatchType }).match_type ?? 'contains'
  return `${MATCH_LABELS[mt]} "${rule.keyword}"`
}

function RuleRow({
  rule, boardName, onToggle, onEdit, onDelete,
}: {
  rule: CategorizationRule
  boardName?: string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', !rule.active && 'opacity-50')}>
      <button onClick={onToggle} className="shrink-0 text-slate-400 hover:text-blue-500 transition-colors">
        {rule.active
          ? <ToggleRight className="h-5 w-5 text-blue-500" />
          : <ToggleLeft className="h-5 w-5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded font-semibold">
            {rule.keyword}
          </span>
          <span className="text-xs text-slate-400">
            ({matchDescription(rule).split('"')[0].trim()})
          </span>
          {rule.auto_created && (
            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-full">
              Automática
            </span>
          )}
        </div>
        {boardName && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">→ conta: {boardName}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3 w-3 text-slate-400" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={onDelete}>
          <Trash2 className="h-3 w-3 text-slate-400" />
        </Button>
      </div>
    </div>
  )
}

function CategoryGroup({
  category, rules, boardMap, onToggle, onEdit, onDelete,
}: {
  category: string
  rules: CategorizationRule[]
  boardMap: Record<string, string>
  onToggle: (id: string, active: boolean) => void
  onEdit: (rule: CategorizationRule) => void
  onDelete: (rule: CategorizationRule) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = rules.filter(r => r.active).length

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
        }
        <span className="flex-1 font-semibold text-sm text-slate-700 dark:text-slate-200">{category}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {activeCount}/{rules.length} ativa{rules.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-slate-100 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
          {rules.map(rule => (
            <RuleRow
              key={rule.id}
              rule={rule}
              boardName={(rule as CategorizationRule & { board_id?: string }).board_id ? boardMap[(rule as CategorizationRule & { board_id?: string }).board_id!] : undefined}
              onToggle={() => onToggle(rule.id, !rule.active)}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type RetroResult = { count: number; keyword: string; schemaWarning?: boolean; error?: string }

// Categorias tipo "Ambos" (ex: "Outros") valem pros três tipos de transação —
// regras que apontam pra elas caem nesta seção em vez de uma específica. Se uma
// regra "de transferência" foi criada apontando pra "Outros" em vez de uma
// categoria com Tipo = Transferência, ela aparece aqui, não em "Transferências".
type SectionKey = 'despesa' | 'receita' | 'transferencia' | 'ambos'

const SECTION_ORDER: SectionKey[] = ['despesa', 'receita', 'transferencia', 'ambos']

const SECTION_META: Record<SectionKey, { label: string; icon: React.ElementType; iconColor: string; iconBg: string; help: string }> = {
  despesa: {
    label: 'Despesas', icon: TrendingDown, iconColor: 'text-red-500', iconBg: 'bg-red-50 dark:bg-red-900/20',
    help: 'Regras que apontam pra uma categoria de despesa.',
  },
  receita: {
    label: 'Receitas', icon: TrendingUp, iconColor: 'text-green-500', iconBg: 'bg-green-50 dark:bg-green-900/20',
    help: 'Regras que apontam pra uma categoria de receita.',
  },
  transferencia: {
    label: 'Transferências', icon: ArrowLeftRight, iconColor: 'text-slate-400', iconBg: 'bg-slate-100 dark:bg-slate-700',
    help: 'Regras que apontam pra uma categoria de transferência.',
  },
  ambos: {
    label: 'Ambos', icon: Layers, iconColor: 'text-violet-500', iconBg: 'bg-violet-50 dark:bg-violet-900/20',
    help: 'Regras que apontam pra uma categoria do tipo "Ambos" (ex: "Outros") — vale pra despesa, receita ou transferência ao mesmo tempo, por isso não entra numa seção específica.',
  },
}

export default function RulesPage() {
  const { rules, loading, createRule, updateRule, deleteRule } = useRules()
  const { categories } = useCategories()
  const { boards } = useTransactionBoards()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CategorizationRule | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState<CategorizationRule | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [retroResult, setRetroResult] = useState<RetroResult | null>(null)

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

  function sectionFor(categoryName: string): SectionKey {
    const type = categoryTypeMap.get(categoryName)
    if (type === 'despesa' || type === 'receita' || type === 'transferencia') return type
    return 'ambos'
  }

  const grouped = useMemo(() => {
    const filtered = search.trim()
      ? rules.filter(r =>
          r.keyword.toLowerCase().includes(search.toLowerCase()) ||
          r.category.toLowerCase().includes(search.toLowerCase())
        )
      : rules
    const map = new Map<string, CategorizationRule[]>()
    for (const rule of filtered) {
      const arr = map.get(rule.category) ?? []
      arr.push(rule)
      map.set(rule.category, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [rules, search])

  const groupedBySection = useMemo(() => {
    const buckets: Record<SectionKey, [string, CategorizationRule[]][]> = {
      despesa: [], receita: [], transferencia: [], ambos: [],
    }
    for (const entry of grouped) {
      buckets[sectionFor(entry[0])].push(entry)
    }
    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, categoryTypeMap])

  function openCreate() { setEditing(null); setForm(EMPTY); setFormOpen(true) }
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
      type: existingType === 'receita' || existingType === 'despesa' || existingType === 'transferencia' ? existingType : 'despesa',
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
  const specialCategoryOptions = typeFilteredCategories.filter(c => (c.special_dates?.length ?? 0) > 0)
  const selectedIsSpecial = specialCategoryOptions.some(c => c.name === form.category)

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

  if (loading) return null

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Regras de categorização</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {rules.length} regra{rules.length !== 1 ? 's' : ''} em {grouped.length} categoria{grouped.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      {/* Info */}
      <InfoBox id="rules-como-funciona">
        <p className="text-blue-600 dark:text-blue-400">
          Na importação, cada transação é testada contra as regras ativas e a primeira que combinar define a categoria automaticamente.
          Ao criar ou editar uma regra aqui, todas as transações anteriores que combinam são atualizadas imediatamente — mantendo o histórico sempre correto.
        </p>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Regras automáticas
            <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-full">Automática</span>
          </p>
          <p className="text-blue-600 dark:text-blue-400">
            Você não precisa criar regra na mão pra corrigir uma categoria: mude a categoria de qualquer transação (em Contas e Cartões ou Análise) e o app já cria — ou atualiza, se já existir uma pra essa descrição — uma regra de correspondência exata sozinho, aplicando a mudança em todo o histórico. Essas regras aparecem aqui com a etiqueta roxa &ldquo;Automática&rdquo;, junto com as que você cria manualmente, e podem ser editadas ou excluídas como qualquer outra.
          </p>
        </div>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">Não achou sua regra na seção esperada?</p>
          <p className="text-blue-600 dark:text-blue-400">
            A seção é definida pelo <strong>Tipo da categoria</strong> que a regra aponta, não pela intenção de quando você criou. Uma regra que muda a categoria pra &ldquo;Outros&rdquo; sempre aparece em &ldquo;Ambos&rdquo; — mesmo que a transação seja uma transferência — porque &ldquo;Outros&rdquo; é do tipo &ldquo;Ambos&rdquo;. Pra ela aparecer em &ldquo;Transferências&rdquo;, a categoria de destino precisa ser criada com Tipo = Transferência em Configurações → Categorias.
          </p>
        </div>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">Categoria isolada fica de fora das regras</p>
          <p className="text-blue-600 dark:text-blue-400">
            Categorias isoladas (presas a um mês específico) nunca entram nesse sistema de regras — nem criam regra automática, nem são sobrescritas por nenhuma regra. Uma vez que você marca uma transação com categoria isolada, ela fica só ali, sem afetar nem ser afetada pelas outras.
          </p>
        </div>
        <div className="border-t border-blue-200 dark:border-blue-800 pt-2.5">
          <p className="font-semibold mb-1">Não quer criar regra pra uma edição específica?</p>
          <p className="text-blue-600 dark:text-blue-400">
            Ao editar a categoria de uma transação (em Contas e Cartões), marque a opção &ldquo;Mudar só esta transação&rdquo; que aparece no formulário — a categoria muda só ali, sem criar/atualizar regra nem afetar outras transações com a mesma descrição.
          </p>
        </div>
      </InfoBox>

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

      {/* Search */}
      {rules.length > 0 && (
        <Input
          placeholder="Buscar por palavra-chave ou categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white dark:bg-slate-800"
        />
      )}

      {/* Empty */}
      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          iconColor="text-amber-500"
          iconBg="bg-amber-50 dark:bg-amber-500/15"
          title="Nenhuma regra criada"
          description="Regras automatizam a categorização das suas importações. Ex: tudo que contém 'UBER' vai para Transporte."
          primaryLabel="Criar primeira regra"
          primaryOnClick={openCreate}
          secondaryLabel="Ver ajuda"
          secondaryHref="/help"
        />
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">Nenhuma regra encontrada para &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="space-y-6">
          {SECTION_ORDER.map(key => {
            const entries = groupedBySection[key]
            if (entries.length === 0) return null
            const { label, icon: Icon, iconColor, iconBg, help } = SECTION_META[key]
            return (
              <section key={key} className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconBg)}>
                      <Icon className={cn('h-4 w-4', iconColor)} />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{label}</h2>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-9">{help}</p>
                </div>
                {entries.map(([category, catRules]) => (
                  <CategoryGroup
                    key={category}
                    category={category}
                    rules={catRules}
                    boardMap={boardMap}
                    onToggle={(id, active) => updateRule(id, { active })}
                    onEdit={openEdit}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}

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
                <div className={specialCategoryOptions.length > 0 ? 'grid grid-cols-2 gap-2' : ''}>
                  <Select value={selectedIsSpecial ? '' : form.category} onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}>
                    <SelectTrigger id="rule-category" className="w-full">
                      <SelectValue placeholder="Selecione a categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {normalCategoryOptions.length === 0 ? (
                        <SelectItem value="__empty__" disabled>Nenhuma categoria disponível</SelectItem>
                      ) : (
                        normalCategoryOptions.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {specialCategoryOptions.length > 0 && (
                    <Select value={selectedIsSpecial ? form.category : ''} onValueChange={v => { if (v) setForm(f => ({ ...f, category: v })) }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Categoria isolada..." />
                      </SelectTrigger>
                      <SelectContent>
                        {specialCategoryOptions.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {boards.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="rule-board" className="text-xs">Mover para conta (opcional)</Label>
                  <Select value={form.board_id} onValueChange={v => setForm(f => ({ ...f, board_id: v ?? '' }))}>
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
