'use client'

import { useState, useEffect } from 'react'
import { Category, DEFAULT_CATEGORIES } from '@/types'
import { createClient } from '@/lib/supabase/client'

function uid() {
  return crypto.randomUUID()
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchCategories() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (data && data.length > 0) {
      setCategories(data as Category[])
    } else {
      // Primeira vez: semeia as categorias padrão
      const defaults: Category[] = DEFAULT_CATEGORIES.map(c => ({
        ...c,
        id: uid(),
        user_id: user.id,
        created_at: new Date().toISOString(),
      }))
      await supabase.from('categories').insert(defaults)
      setCategories(defaults)
    }
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])

  async function createCategory(cat: Omit<Category, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const duplicate = categories.find(c => c.name.toLowerCase() === cat.name.toLowerCase())
    if (duplicate) return { error: 'Já existe uma categoria com esse nome.' }

    const newCat: Category = {
      ...cat,
      id: uid(),
      user_id: user.id,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('categories').insert(newCat)
    if (error) return { error: error.message }
    setCategories(prev => [...prev, newCat])
    return { error: null }
  }

  async function updateCategory(id: string, cat: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const oldCategory = categories.find(c => c.id === id)
    const { error } = await supabase.from('categories').update(cat).eq('id', id)
    if (error) return { error: error.message }

    // Se o nome mudou, cascadeia para transactions, regras e planejamento
    if (cat.name && oldCategory && cat.name !== oldCategory.name) {
      const oldName = oldCategory.name
      const newName = cat.name

      // 1. Transações: atualiza o campo category
      await supabase
        .from('transactions')
        .update({ category: newName })
        .eq('user_id', user.id)
        .eq('category', oldName)

      // 2. Regras automáticas: atualiza o campo category
      await supabase
        .from('categorization_rules')
        .update({ category: newName })
        .eq('user_id', user.id)
        .eq('category', oldName)

      // 3. Planejamento: renomeia a chave no JSON category_limits
      const { data: plans } = await supabase
        .from('budget_plans')
        .select('id, category_limits')
        .eq('user_id', user.id)

      for (const plan of plans ?? []) {
        const limits = plan.category_limits as Record<string, number>
        if (!(oldName in limits)) continue
        const updated = { ...limits, [newName]: limits[oldName] }
        delete updated[oldName]
        await supabase
          .from('budget_plans')
          .update({ category_limits: updated })
          .eq('id', plan.id)
      }
    }

    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...cat } : c)))
    return { error: null }
  }

  async function deleteCategory(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) return { error: error.message }
    setCategories(prev => prev.filter(c => c.id !== id))
    return { error: null }
  }

  async function seedDefaults() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const existing = categories.map(c => c.name.toLowerCase())
    const toAdd: Category[] = DEFAULT_CATEGORIES
      .filter(c => !existing.includes(c.name.toLowerCase()))
      .map(c => ({ ...c, id: uid(), user_id: user.id, created_at: new Date().toISOString() }))

    if (toAdd.length === 0) return { error: null }
    const { error } = await supabase.from('categories').insert(toAdd)
    if (error) return { error: error.message }
    setCategories(prev => [...prev, ...toAdd])
    return { error: null }
  }

  return {
    categories,
    loading,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    seedDefaults,
  }
}
