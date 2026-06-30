'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export function applyUserRules(
  description: string,
  rules: CategorizationRule[]
): { category: string | null; board_id: string | null } {
  for (const rule of rules) {
    if (rule.active && matchesRule(description, rule)) {
      return { category: rule.category, board_id: rule.board_id ?? null }
    }
  }
  return { category: null, board_id: null }
}

export async function applyRuleToExisting(rule: {
  keyword: string; match_type: string; category: string; board_id: string | null
}): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: txs } = await supabase
    .from('transactions')
    .select('id, description')
    .eq('user_id', user.id)

  if (!txs?.length) return 0

  const kw = rule.keyword.toUpperCase()
  const ids = txs
    .filter(t => {
      const desc = t.description.toUpperCase()
      switch (rule.match_type) {
        case 'starts_with': return desc.startsWith(kw)
        case 'ends_with':   return desc.endsWith(kw)
        case 'exact':       return desc === kw
        default:            return desc.includes(kw)
      }
    })
    .map(t => t.id)

  if (!ids.length) return 0

  const update: Record<string, unknown> = { category: rule.category }
  if (rule.board_id) update.board_id = rule.board_id

  const { error } = await supabase.from('transactions').update(update).in('id', ids)
  return error ? 0 : ids.length
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

  return { rules, loading, createRule, updateRule, deleteRule }
}
