'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Subcategory, TransactionType } from '@/types'

function sortSubcategories(list: Subcategory[]): Subcategory[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function useSubcategories() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriesByLabel, setCategoriesByLabel] = useState<Record<string, string[]>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Subcategorias pré-criadas ficam no user_metadata; as já atribuídas vêm das transações
    const rawMeta = (user.user_metadata?.subcategories as unknown[] | undefined) ?? []

    const { data: txRows } = await supabase
      .from('transactions')
      .select('group_label, type, category')
      .eq('user_id', user.id)
      .not('group_label', 'is', null)

    // Quais categorias aparecem nas transações de cada subcategoria (só pra exibição).
    const categorySets = new Map<string, Set<string>>()
    for (const row of txRows ?? []) {
      const label = row.group_label as string | null
      const category = row.category as string | null
      if (!label || !category) continue
      if (!categorySets.has(label)) categorySets.set(label, new Set())
      categorySets.get(label)!.add(category)
    }
    const categoriesByLabelResult: Record<string, string[]> = {}
    for (const [label, set] of categorySets) {
      categoriesByLabelResult[label] = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }
    setCategoriesByLabel(categoriesByLabelResult)

    // Vota o tipo mais comum entre as transações que já usam cada rótulo —
    // usado só pra migrar dados antigos (formato de string pura, sem tipo).
    const votes = new Map<string, Record<TransactionType, number>>()
    for (const row of txRows ?? []) {
      const label = row.group_label as string | null
      const type = row.type as TransactionType
      if (!label) continue
      const v = votes.get(label) ?? { despesa: 0, receita: 0, transferencia: 0 }
      v[type] = (v[type] ?? 0) + 1
      votes.set(label, v)
    }
    function inferType(label: string): TransactionType {
      const v = votes.get(label)
      if (!v) return 'despesa'
      return (Object.entries(v) as [TransactionType, number][]).sort((a, b) => b[1] - a[1])[0][0]
    }

    // Migração: entradas antigas eram strings puras (sem tipo). Só acontece
    // uma vez — depois disso o tipo fica gravado e não é mais recalculado.
    let migrated = false
    const migratedMeta: Subcategory[] = rawMeta.map(item => {
      if (typeof item === 'string') {
        migrated = true
        return { name: item, type: inferType(item) }
      }
      return item as Subcategory
    })

    // Rótulos que existem em transações mas nunca foram formalmente criados
    // (ex: atribuídos direto no banco em algum momento antigo)
    const metaNames = new Set(migratedMeta.map(s => s.name))
    for (const label of new Set((txRows ?? []).map(r => r.group_label as string).filter(Boolean))) {
      if (!metaNames.has(label)) {
        migratedMeta.push({ name: label, type: inferType(label) })
        migrated = true
      }
    }

    const finalList = sortSubcategories(migratedMeta)

    if (migrated) {
      await supabase.auth.updateUser({ data: { subcategories: finalList } })
    }

    setSubcategories(finalList)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createSubcategory(name: string, type: TransactionType): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) return false
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    if (subcategories.some(s => s.name === trimmed)) {
      return true // já existe — idempotente
    }

    const updated = sortSubcategories([...subcategories, { name: trimmed, type }])
    const { error } = await supabase.auth.updateUser({ data: { subcategories: updated } })

    if (error) { console.error('Erro ao criar subcategoria:', error); return false }
    setSubcategories(updated)
    return true
  }

  async function renameSubcategory(oldName: string, newName: string, newType: TransactionType): Promise<boolean> {
    const trimmed = newName.trim()
    if (!trimmed) return false
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const updated = sortSubcategories(
      subcategories.map(s => s.name === oldName ? { name: trimmed, type: newType } : s)
    )

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.auth.updateUser({ data: { subcategories: updated } }),
      trimmed !== oldName
        ? supabase.from('transactions').update({ group_label: trimmed }).eq('user_id', user.id).eq('group_label', oldName)
        : Promise.resolve({ error: null }),
    ])

    if (e1 || e2) { console.error('Erro ao renomear:', e1 || e2); return false }
    setSubcategories(updated)
    if (trimmed !== oldName) {
      setCategoriesByLabel(prev => {
        if (!(oldName in prev)) return prev
        const { [oldName]: moved, ...rest } = prev
        return { ...rest, [trimmed]: moved }
      })
    }
    return true
  }

  async function deleteSubcategory(name: string): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const updated = subcategories.filter(s => s.name !== name)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.auth.updateUser({ data: { subcategories: updated } }),
      supabase.from('transactions')
        .update({ group_label: null })
        .eq('user_id', user.id)
        .eq('group_label', name),
    ])

    if (e1 || e2) { console.error('Erro ao excluir:', e1 || e2); return false }
    setSubcategories(updated)
    setCategoriesByLabel(prev => {
      if (!(name in prev)) return prev
      const { [name]: _removed, ...rest } = prev
      return rest
    })
    return true
  }

  // Move todas as transações de uma categoria (do mesmo tipo da subcategoria)
  // pra dentro do grupo — mesmo efeito de atribuir subcategoria uma a uma,
  // mas em lote por categoria inteira.
  async function assignCategoryToSubcategory(label: string, categoryName: string): Promise<boolean> {
    const sub = subcategories.find(s => s.name === label)
    if (!sub) return false
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('transactions')
      .update({ group_label: label })
      .eq('user_id', user.id)
      .eq('category', categoryName)
      .eq('type', sub.type)

    if (error) { console.error('Erro ao adicionar categoria à subcategoria:', error); return false }

    setCategoriesByLabel(prev => {
      const current = prev[label] ?? []
      if (current.includes(categoryName)) return prev
      return { ...prev, [label]: [...current, categoryName].sort((a, b) => a.localeCompare(b, 'pt-BR')) }
    })
    return true
  }

  async function assignSubcategory(descriptions: string[], label: string | null): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from('transactions')
      .update({ group_label: label })
      .eq('user_id', user.id)
      .in('description', descriptions)

    if (error) { console.error('Erro ao atribuir subcategoria:', error.code, error.message, error.details); return false }
    return true
  }

  return {
    subcategories,
    loading,
    categoriesByLabel,
    createSubcategory,
    renameSubcategory,
    deleteSubcategory,
    assignSubcategory,
    assignCategoryToSubcategory,
    refetch: load,
  }
}
