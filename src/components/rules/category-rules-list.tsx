'use client'

import { useState } from 'react'
import { ChevronRight, MoreVertical, Pencil, Trash2, ToggleLeft, ToggleRight, Plus, Search, Zap } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { CategorizationRule } from '@/hooks/use-rules'
import { Category } from '@/types'
import { CategoryIcon, categoryIconKey, guessIconKey } from '@/lib/category-icons'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { cn } from '@/lib/utils'

export type RuleFilter = 'all' | 'manual' | 'auto' | 'off' | 'zero' | 'conflict' | 'redundant'

const MATCH_LABELS: Record<string, string> = {
  contains: 'Contém', starts_with: 'Começa com', ends_with: 'Termina com', exact: 'Igual a',
}

/**
 * Regras de categoria no modelo da Análise / Categorias: uma linha por
 * categoria (ícone e cor), abrindo as regras com palavra, tipo de
 * correspondência, Manual/Automática, quantos lançamentos pega e ⋮.
 */
export function CategoryRulesList({
  rules, categories, uses, usesLoading = false, conflictIds, redundant, filter, onFilter, search, onSearch, boardMap,
  onToggle, onEdit, onDelete, onCreateIn,
}: {
  rules: CategorizationRule[]
  categories: Category[]
  /** Quantos lançamentos cada regra pega hoje (por id). */
  uses: Map<string, number>
  /** Lançamentos ainda carregando: não mostrar contagem nem "não pega nada". */
  usesLoading?: boolean
  conflictIds: Set<string>
  /** Regra repetida → a regra mais geral, de mesma categoria, que já a cobre. */
  redundant: Map<string, CategorizationRule>
  filter: RuleFilter
  onFilter: (f: RuleFilter) => void
  search: string
  onSearch: (v: string) => void
  boardMap: Record<string, string>
  onToggle: (r: CategorizationRule) => void
  onEdit: (r: CategorizationRule) => void
  onDelete: (r: CategorizationRule) => void
  onCreateIn: (category: string) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  const mothers = motherNameByCategory(categories)
  const q = search.trim().toLowerCase()

  const pass = (r: CategorizationRule) => {
    if (filter === 'manual' && r.auto_created) return false
    if (filter === 'auto' && !r.auto_created) return false
    if (filter === 'off' && r.active) return false
    if (filter === 'zero' && (!r.active || (uses.get(r.id) ?? 0) > 0)) return false
    if (filter === 'conflict' && !conflictIds.has(r.id)) return false
    if (filter === 'redundant' && !redundant.has(r.id)) return false
    if (q && !r.keyword.toLowerCase().includes(q) && !r.category.toLowerCase().includes(q) && !motherOf(r.category, mothers).toLowerCase().includes(q)) return false
    return true
  }
  const visible = rules.filter(pass)
  const byMother = new Map<string, CategorizationRule[]>()
  for (const r of visible) {
    const m = motherOf(r.category, mothers)
    byMother.set(m, [...(byMother.get(m) ?? []), r])
  }
  const groups = [...byMother.entries()].sort(([a], [b]) => {
    if (a.toLowerCase() === 'outros') return 1
    if (b.toLowerCase() === 'outros') return -1
    return a.localeCompare(b, 'pt-BR')
  })
  const forceOpen = !!q || filter === 'zero' || filter === 'conflict' || filter === 'redundant'
  const counts = {
    all: rules.length,
    manual: rules.filter(r => !r.auto_created).length,
    auto: rules.filter(r => r.auto_created).length,
    off: rules.filter(r => !r.active).length,
  }
  function renderRule(r: CategorizationRule) {
    const n = uses.get(r.id) ?? 0
    const mt = (r as CategorizationRule & { match_type?: string }).match_type ?? 'contains'
    const boardId = (r as CategorizationRule & { board_id?: string | null }).board_id
    return (
      <div key={r.id} className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03]', !r.active && 'opacity-50')}>
        <button type="button" onClick={() => onToggle(r)} className="shrink-0" title={r.active ? 'Desativar' : 'Ativar'}>
          {r.active ? <ToggleRight className="h-5 w-5 text-blue-500" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
        </button>
        <span className="text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded">{r.keyword}</span>
        <span className="text-[11px] text-slate-400">{MATCH_LABELS[mt] ?? 'Contém'}</span>
        
        <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5',
          r.auto_created ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')}>
          {r.auto_created ? 'Automática' : 'Manual'}
        </span>
        {!usesLoading && r.active && n === 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">não pega nada</span>}
        {conflictIds.has(r.id) && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">em conflito</span>}
        {redundant.has(r.id) && (
          <span
            title={`A regra "${redundant.get(r.id)!.keyword}" já pega este lançamento com a mesma categoria.`}
            className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300"
          >
            repetida · coberta por &ldquo;{redundant.get(r.id)!.keyword}&rdquo;
          </span>
        )}
        {boardId && boardMap[boardId] && <span className="text-[11px] text-slate-400">· conta {boardMap[boardId]}</span>}
        <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{usesLoading ? 'contando…' : `${n} lançamento${n === 1 ? '' : 's'}`}</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0" aria-label="Ações da regra">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(r)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggle(r)}>
              {r.active ? <><ToggleLeft className="h-4 w-4 mr-2" /> Desativar</> : <><ToggleRight className="h-4 w-4 mr-2" /> Ativar</>}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(r)}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  const chip = (on: boolean) => cn(
    'rounded-full border px-3 py-1 text-xs transition-colors',
    on ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:border-blue-300',
  )
  const styleOf = (name: string) => {
    const c = categories.find(x => !x.parent_id && x.name === name)
    return { color: c?.color ?? '#94a3b8', iconKey: c ? categoryIconKey(c, categories) : guessIconKey(name) }
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-5 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Regras por categoria</h2>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">
          Clique numa categoria para ver as regras. Se duas combinarem, vale a criada primeiro.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar palavra-chave ou categoria..." value={search} onChange={e => onSearch(e.target.value)} className="pl-9" />
          </div>
          <button type="button" className={chip(filter === 'all')} onClick={() => onFilter('all')}>Todas · {counts.all}</button>
          <button type="button" className={chip(filter === 'manual')} onClick={() => onFilter('manual')}>Manuais · {counts.manual}</button>
          <button type="button" className={chip(filter === 'auto')} onClick={() => onFilter('auto')}>Automáticas · {counts.auto}</button>
          {counts.off > 0 && <button type="button" className={chip(filter === 'off')} onClick={() => onFilter('off')}>Desativadas · {counts.off}</button>}
          {(filter === 'zero' || filter === 'conflict' || filter === 'redundant') && (
            <button type="button" className={chip(true)} onClick={() => onFilter('all')}>
              {filter === 'zero' ? 'Não pegam nada' : filter === 'conflict' ? 'Em conflito' : 'Repetidas'} ✕
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Nenhuma regra neste filtro.</p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60">
            {groups.map(([mother, list]) => {
              const isOpen = forceOpen || open.has(mother)
              const { color, iconKey } = styleOf(mother)
              const active = list.filter(r => r.active).length
              return (
                <div key={mother} className="py-3">
                  <div className="flex items-center gap-3">
                    <button type="button" aria-expanded={isOpen}
                      onClick={() => setOpen(prev => { const n = new Set(prev); if (n.has(mother)) n.delete(mother); else n.add(mother); return n })}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left group">
                      <ChevronRight className={cn('h-4 w-4 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                      <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1f`, color }}>
                        <CategoryIcon iconKey={iconKey} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:underline">{mother}</span>
                        <span className="block text-[11px] text-slate-400">{list.length} regra{list.length === 1 ? '' : 's'} · {active} ativa{active === 1 ? '' : 's'}</span>
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] shrink-0" aria-label={`Ações de ${mother}`}>
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => onCreateIn(mother)}><Plus className="h-4 w-4 mr-2" /> Nova regra em {mother}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isOpen && (
                    <div className="mt-2 ml-[30px] pl-3 border-l-2 border-slate-100 dark:border-white/[0.08]">
                      {(() => {
                        // Subcategorias recolhidas; regras direto na categoria
                        // ficam num grupo próprio. Sem subcategorias, lista direto.
                        const subs = new Map<string, CategorizationRule[]>()
                        for (const r of list) subs.set(r.category, [...(subs.get(r.category) ?? []), r])
                        const entries = [...subs.entries()].sort(([x], [y]) => {
                          if (x === mother) return -1
                          if (y === mother) return 1
                          return x.localeCompare(y, 'pt-BR')
                        })
                        if (entries.length === 1 && entries[0][0] === mother) return list.map(renderRule)
                        return entries.map(([sub, subRules]) => {
                          const key = `${mother}|${sub}`
                          const subOpen = forceOpen || openSubs.has(key)
                          const subActive = subRules.filter(r => r.active).length
                          return (
                            <div key={key}>
                              <button type="button" aria-expanded={subOpen}
                                onClick={() => setOpenSubs(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })}
                                className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                                <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform', subOpen && 'rotate-90')} />
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="flex-1 min-w-0 text-[13px] text-slate-700 dark:text-slate-200 truncate">
                                  {sub}
                                  {sub === mother && (
                                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">sem subcategoria</span>
                                  )}
                                </span>
                                <span className="text-[11px] text-slate-400 shrink-0">{subRules.length} regra{subRules.length === 1 ? '' : 's'} · {subActive} ativa{subActive === 1 ? '' : 's'}</span>
                              </button>
                              {subOpen && (
                                <div className="ml-5 pl-3 border-l-2 border-slate-100 dark:border-white/[0.08] mb-1">
                                  {subRules.map(renderRule)}
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                      <button type="button" onClick={() => onCreateIn(mother)} className="mt-1 ml-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                        <Plus className="h-3.5 w-3.5" /> Nova regra em {mother}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 bg-slate-50 dark:bg-slate-700/40 flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{groups.length} categoria{groups.length === 1 ? '' : 's'} com regras</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{rules.length} regras · {rules.filter(r => r.active).length} ativas</span>
      </div>
    </section>
  )
}
