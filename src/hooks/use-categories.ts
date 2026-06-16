'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, DEFAULT_CATEGORIES } from '@/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) {
        console.error('Erro ao buscar categorias:', error.message)
        setCategories([])
        return
      }

      setCategories((data as Category[]) ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createCategory(cat: Omit<Category, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { error } = await supabase
      .from('categories')
      .insert({ ...cat, user_id: user.id })

    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  async function updateCategory(id: string, cat: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { error } = await supabase.from('categories').update(cat).eq('id', id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  async function deleteCategory(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  async function seedDefaults() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    // Insere apenas categorias que ainda não existem
    const existing = categories.map(c => c.name.toLowerCase())
    const toInsert = DEFAULT_CATEGORIES
      .filter(c => !existing.includes(c.name.toLowerCase()))
      .map(c => ({ ...c, user_id: user.id }))

    if (!toInsert.length) return { error: null }

    const { error } = await supabase.from('categories').insert(toInsert)
    if (!error) await fetch()
    return { error: error?.message ?? null }
  }

  return { categories, loading, refetch: fetch, createCategory, updateCategory, deleteCategory, seedDefaults }
}
