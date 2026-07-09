'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, TransactionType } from '@/types'
import { isCategoryUsableForDate } from '@/lib/special-category-filter'

export type MatchType = 'contains' | 'starts_with' | 'ends_with' | 'exact'

export interface CategorizationRule {
  id: string
  user_id: string
  keyword: string
  match_type: MatchType
  category: string
  board_id: string | null
  active: boolean
  created_at: string
  auto_created?: boolean
}

function matchesRule(description: string, rule: CategorizationRule): boolean {
  const desc = description.toUpperCase()
  const kw   = rule.keyword.toUpperCase()
  switch (rule.match_type) {
    case 'starts_with': return desc.startsWith(kw)
    case 'ends_with':   return desc.endsWith(kw)
    case 'exact':       return desc === kw
    default:            return desc.includes(kw)
  }
}

// Se a categoria da regra for especial (presa a meses específicos), a regra só
// vale para transações cuja data caia em um dos meses configurados nela.
function ruleUsableForDate(rule: CategorizationRule, date: string, categories: Category[]): boolean {
  const cat = categories.find(c => c.name === rule.category)
  if (!cat) return true
  return isCategoryUsableForDate(cat, date)
}

// Uma regra só pode ser aplicada a uma transação do mesmo tipo da sua categoria
// alvo (receita/despesa/transferência) — "ambos" (ex: "Outros") vale pra qualquer
// tipo. Evita que uma descrição igual por coincidência (ex: "Ajuste") em contextos
// diferentes espalhe categoria de transferência pra despesa ou vice-versa.
function ruleUsableForType(rule: CategorizationRule, type: TransactionType, categories: Category[]): boolean {
  const cat = categories.find(c => c.name === rule.category)
  if (!cat) return true
  return cat.type === type || cat.type === 'ambos'
}

export function applyUserRules(
  description: string,
  date: string,
  rules: CategorizationRule[],
  categories: Category[],
  type: TransactionType
): { category: string | null; board_id: string | null } {
  for (const rule of rules) {
    if (
      rule.active &&
      matchesRule(description, rule) &&
      ruleUsableForDate(rule, date, categories) &&
      ruleUsableForType(rule, type, categories)
    ) {
      return { category: rule.category, board_id: rule.board_id ?? null }
    }
  }
  return { category: null, board_id: null }
}

// Igual applyRuleToExisting, mas pro campo `type` (Despesa/Receita/Transferência)
// em vez de categoria — mudar o Tipo de uma transação editada também "gruda"
// em todas as outras com a mesma descrição exata, do mesmo jeito que já
// acontecia só com categoria. Sem isso, corrigir o tipo de UMA transação de
// Pix (ex: de Despesa pra Transferência) deixava as demais com a mesma
// descrição presas no tipo antigo.
export async function applyTypeToExisting(
  description: string,
  newType: TransactionType,
): Promise<{ count: number; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const kw = description.trim().toUpperCase()
  if (!kw) return { count: 0 }

  const txs: { id: string; description: string }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description')
      .eq('user_id', user.id)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[applyTypeToExisting] select error:', error.message, '| code:', error.code)
      return { count: 0, error: error.message }
    }
    if (!data?.length) break
    txs.push(...data)
    if (data.length < PAGE) break
  }

  const ids = txs.filter(t => t.description.trim().toUpperCase() === kw).map(t => t.id)
  if (!ids.length) return { count: 0 }

  const { data, error } = await supabase.from('transactions').update({ type: newType }).in('id', ids).select('id')
  if (error) {
    console.error('[applyTypeToExisting] update error:', error.message, '| code:', error.code, '| details:', error.details)
    const friendly = error.code === '23514'
      ? 'Tipo não permitido pelo banco de dados. Rode a migração migration_transferencia_categories.sql no Supabase.'
      : error.message
    return { count: 0, error: friendly }
  }
  return { count: data?.length ?? 0 }
}

export async function applyRuleToExisting(
  rule: { keyword: string; match_type: string; category: string; board_id: string | null },
  categories: Category[]
): Promise<{ count: number; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const targetCategory = categories.find(c => c.name === rule.category)
  // Categoria especial nunca é sobrescrita por uma regra — uma vez que uma
  // transação está numa categoria especial, ela fica isolada (só muda por edição manual).
  const specialCategoryNames = new Set(
    categories.filter(c => c.special_dates && c.special_dates.length > 0).map(c => c.name)
  )

  // Busca paginada — o Supabase limita a 1000 linhas por consulta por padrão,
  // então sem paginação transações além desse limite seriam ignoradas em silêncio.
  const txs: { id: string; description: string; date: string; category: string; type: string }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, date, category, type')
      .eq('user_id', user.id)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[applyRuleToExisting] select error:', error.message, '| code:', error.code)
      return { count: 0, error: error.message }
    }
    if (!data?.length) break
    txs.push(...data)
    if (data.length < PAGE) break
  }

  if (!txs.length) return { count: 0 }

  const kw = rule.keyword.toUpperCase()
  const ids = txs
    .filter(t => {
      if (specialCategoryNames.has(t.category)) return false
      const desc = t.description.toUpperCase()
      const descMatches = (() => {
        switch (rule.match_type) {
          case 'starts_with': return desc.startsWith(kw)
          case 'ends_with':   return desc.endsWith(kw)
          case 'exact':       return desc === kw
          default:            return desc.includes(kw)
        }
      })()
      if (!descMatches) return false
      if (!targetCategory) return true
      if (targetCategory.type !== 'ambos' && targetCategory.type !== t.type) return false
      return isCategoryUsableForDate(targetCategory, t.date)
    })
    .map(t => t.id)

  if (!ids.length) return { count: 0 }

  const update: Record<string, unknown> = { category: rule.category }
  if (rule.board_id) update.board_id = rule.board_id

  // `.select()` no update pra pegar a contagem REAL de linhas afetadas — sem
  // isso, um update que bate 0 linhas (ex: RLS barrando silenciosamente, ou
  // update sem erro mas sem efeito) ainda reportava `ids.length` como se
  // tivesse dado certo, mostrando "N transações atualizadas" mesmo quando
  // nada mudou de verdade no banco.
  const { data, error } = await supabase.from('transactions').update(update).in('id', ids).select('id')
  if (error) {
    console.error('[applyRuleToExisting] update error:', error.message, '| code:', error.code, '| details:', error.details)
    const friendly = error.code === '23514'
      ? 'Categoria não permitida pelo banco de dados. Rode a migração migration_categories.sql no Supabase.'
      : error.message
    return { count: 0, error: friendly }
  }
  const actualCount = data?.length ?? 0
  if (actualCount < ids.length) {
    console.warn(`[applyRuleToExisting] esperava atualizar ${ids.length} transações, mas só ${actualCount} vieram de volta — possível bloqueio de RLS.`)
  }
  return { count: actualCount }
}

export function useRules() {
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchRules() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('categorization_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    // normalise legacy rows that may lack match_type
    const normalised = (data ?? []).map(r => ({
      ...r,
      match_type: r.match_type ?? 'contains',
      board_id: r.board_id ?? null,
    })) as CategorizationRule[]
    setRules(normalised)
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  async function createRule(
    keyword: string,
    category: string,
    extra?: Partial<Pick<CategorizationRule, 'match_type' | 'board_id'>>
  ) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const id = crypto.randomUUID()
    const fullRule = {
      id,
      user_id: user.id,
      keyword,
      match_type: extra?.match_type ?? 'contains',
      category,
      board_id: extra?.board_id ?? null,
      active: true,
    }
    let res = await supabase
      .from('categorization_rules')
      .insert(fullRule)
      .select()
      .single()

    // Fallback: match_type/board_id columns may not exist yet (migration_rules.sql not yet run)
    if (res.error) {
      res = await supabase
        .from('categorization_rules')
        .insert({ id, user_id: user.id, keyword, category, active: true })
        .select()
        .single()
    }

    if (res.error || !res.data) {
      console.error('Erro ao criar regra:', res.error)
      return
    }
    const saved = res.data as CategorizationRule
    setRules(prev => [...prev, { ...saved, match_type: saved.match_type ?? 'contains', board_id: saved.board_id ?? null }])
    return saved
  }

  async function updateRule(
    id: string,
    data: Partial<Pick<CategorizationRule, 'keyword' | 'match_type' | 'category' | 'board_id' | 'active'>>
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = createClient()

    // Tenta atualizar com todos os campos
    const { error } = await supabase
      .from('categorization_rules')
      .update(data)
      .eq('id', id)

    if (!error) {
      setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
      return { ok: true }
    }

    // Fallback: colunas match_type / board_id podem não existir no banco ainda.
    // Tenta salvar apenas os campos que com certeza existem.
    const safeData: Partial<Pick<CategorizationRule, 'keyword' | 'category' | 'active'>> = {}
    if (data.keyword   !== undefined) safeData.keyword  = data.keyword
    if (data.category  !== undefined) safeData.category = data.category
    if (data.active    !== undefined) safeData.active   = data.active

    if (Object.keys(safeData).length > 0) {
      const { error: error2 } = await supabase
        .from('categorization_rules')
        .update(safeData)
        .eq('id', id)

      if (!error2) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, ...safeData } : r))
        // Retorna aviso (não erro fatal) para que a UI informe sobre a migration
        return { ok: true, error: 'partial' }
      }
    }

    console.error('Erro ao atualizar regra:', error)
    return { ok: false, error: error.message }
  }

  async function deleteRule(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('categorization_rules')
      .delete()
      .eq('id', id)
    if (error) { console.error('Erro ao excluir regra:', error); return }
    setRules(prev => prev.filter(r => r.id !== id))
  }

  // Toda vez que uma transação é recategorizada manualmente para uma categoria
  // NORMAL, cria (ou atualiza) uma regra de correspondência exata pela descrição
  // e aplica retroativamente — assim a mudança "gruda" em todas as transações com
  // esse nome exato, sem precisar criar a regra manualmente. Categoria especial
  // nunca entra aqui: fica isolada, só muda por edição manual, transação por transação.
  // Faz o insert/update direto (não reusa createRule/updateRule) para expor o erro
  // real do Postgres em vez de engolir silenciosamente.
  async function syncCategoryToRule(
    description: string,
    category: string,
    categories: Category[]
  ): Promise<{ applied: number; error?: string }> {
    const targetCategory = categories.find(c => c.name === category)
    const isSpecial = !!(targetCategory?.special_dates && targetCategory.special_dates.length > 0)
    if (isSpecial) return { applied: 0 }

    const kw = description.trim().toUpperCase()
    if (!kw) return { applied: 0 }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { applied: 0, error: 'Não autenticado.' }

    // Upsert atômico no banco (precisa da constraint única de
    // migration_rules_unique.sql em user_id+keyword+match_type) — em vez de
    // "checar se existe, depois inserir ou atualizar". Esse padrão antigo tinha
    // uma corrida real: se duas transações com a mesma descrição fossem
    // recategorizadas quase ao mesmo tempo, as duas checagens podiam rodar
    // ANTES de qualquer inserção terminar, e as duas criavam uma regra —
    // gerando duplicata. Upsert resolve isso no próprio banco, sem essa janela.
    const { data, error } = await supabase
      .from('categorization_rules')
      .upsert(
        {
          user_id: user.id,
          keyword: kw,
          match_type: 'exact',
          category,
          board_id: null,
          active: true,
          auto_created: true,
        },
        { onConflict: 'user_id,keyword,match_type' }
      )
      .select()
      .single()
    if (error || !data) {
      console.error('[syncCategoryToRule] upsert error:', error?.message, '| code:', error?.code, '| details:', error?.details)
      const friendly = error?.code === '23502'
        ? 'A coluna "id" de categorization_rules não tem geração automática configurada. Rode a migração migration_rules_id_default.sql no Supabase.'
        : error?.code === '42P10'
          ? 'Falta uma trava no banco pra evitar regra duplicada. Rode a migração migration_rules_unique.sql no Supabase.'
          : error?.message
      return { applied: 0, error: friendly }
    }
    const rule = data as CategorizationRule
    setRules(prev => (prev.some(r => r.id === rule.id) ? prev.map(r => (r.id === rule.id ? rule : r)) : [...prev, rule]))

    const { count, error: applyError } = await applyRuleToExisting(
      { keyword: rule.keyword, match_type: rule.match_type, category: rule.category, board_id: rule.board_id },
      categories,
    )
    return { applied: count, error: applyError }
  }

  return { rules, loading, createRule, updateRule, deleteRule, syncCategoryToRule }
}
