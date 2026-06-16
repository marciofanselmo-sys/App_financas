'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, DEFAULT_CATEGORIES } from '@/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')

    if (data && data.length === 0) {
      // Primeiro acesso: seed das categorias padrão
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('categories').insert(
          DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }))
        )
        const { data: seeded } = await supabase.from('categories').select('*').order('name')
        setCategories((seeded as Category[]) ?? [])
      }
    } else {
      setCategories((data as Category[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function createCategory(cat: Omit<Category, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }
    const { error } = await supabase.from('categories').insert({ ...cat, user_id: user.id })
    if (!error) fetch()
    return { error }
  }

  async function updateCategory(id: string, cat: Partial<Omit<Category, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { error } = await supabase.from('categories').update(cat).eq('id', id)
    if (!error) fetch()
    return { error }
  }

  async function deleteCategory(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) fetch()
    return { error }
  }

  return { categories, loading, refetch: fetch, createCategory, updateCategory, deleteCategory }
}
