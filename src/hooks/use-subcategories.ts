'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSubcategories() {
  const [subcategories, setSubcategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Subcategorias pré-criadas ficam no user_metadata; as já atribuídas vêm das transações
    const fromMeta = (user.user_metadata?.subcategories as string[] | undefined) ?? []

    const { data: txRows } = await supabase
      .from('transactions')
      .select('group_label')
      .eq('user_id', user.id)
      .not('group_label', 'is', null)

    const fromTxs = (txRows ?? []).map(r => r.group_label as string).filter(Boolean)
    const distinct = [...new Set([...fromMeta, ...fromTxs])].sort()
    setSubcategories(distinct)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createSubcategory(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) return false
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const existing = (user.user_metadata?.subcategories as string[] | undefined) ?? []
    if (existing.includes(trimmed)) {
      setSubcategories(prev => [...new Set([...prev, trimmed])].sort())
      return true
    }

    const updated = [...new Set([...existing, trimmed])].sort()
    const { error } = await supabase.auth.updateUser({ data: { subcategories: updated } })

    if (error) { console.error('Erro ao criar subcategoria:', error); return false }
    setSubcategories(prev => [...new Set([...prev, trimmed])].sort())
    return true
  }

  async function renameSubcategory(oldName: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return false
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const existing = (user.user_metadata?.subcategories as string[] | undefined) ?? []
    const updated = existing.map(s => s === oldName ? trimmed : s).sort()

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.auth.updateUser({ data: { subcategories: updated } }),
      supabase.from('transactions')
        .update({ group_label: trimmed })
        .eq('user_id', user.id)
        .eq('group_label', oldName),
    ])

    if (e1 || e2) { console.error('Erro ao renomear:', e1 || e2); return false }
    setSubcategories(prev => prev.map(s => s === oldName ? trimmed : s).sort())
    return true
  }

  async function deleteSubcategory(name: string): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const existing = (user.user_metadata?.subcategories as string[] | undefined) ?? []
    const updated = existing.filter(s => s !== name)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.auth.updateUser({ data: { subcategories: updated } }),
      supabase.from('transactions')
        .update({ group_label: null })
        .eq('user_id', user.id)
        .eq('group_label', name),
    ])

    if (e1 || e2) { console.error('Erro ao excluir:', e1 || e2); return false }
    setSubcategories(prev => prev.filter(s => s !== name))
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
    createSubcategory,
    renameSubcategory,
    deleteSubcategory,
    assignSubcategory,
    refetch: load,
  }
}
