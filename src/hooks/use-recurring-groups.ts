'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface RecurringGroup {
  id: string
  user_id: string
  name: string
  descriptions: string[]
  created_at: string
}

export function useRecurringGroups() {
  const [groups, setGroups] = useState<RecurringGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('recurring_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setGroups((data ?? []) as RecurringGroup[])
      setLoading(false)
    }
    load()
  }, [])

  async function createGroup(name: string, descriptions: string[]): Promise<RecurringGroup | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('recurring_groups')
      .insert({ user_id: user.id, name, descriptions })
      .select()
      .single()
    if (error || !data) { console.error('Erro ao criar grupo:', error); return null }
    const group = data as RecurringGroup
    setGroups(prev => [...prev, group])
    return group
  }

  async function updateGroup(id: string, name: string, descriptions: string[]) {
    const supabase = createClient()
    const { error } = await supabase
      .from('recurring_groups')
      .update({ name, descriptions })
      .eq('id', id)
    if (error) { console.error('Erro ao atualizar grupo:', error); return }
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name, descriptions } : g))
  }

  async function deleteGroup(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('recurring_groups')
      .delete()
      .eq('id', id)
    if (error) { console.error('Erro ao excluir grupo:', error); return }
    setGroups(prev => prev.filter(g => g.id !== id))
  }

  return { groups, loading, createGroup, updateGroup, deleteGroup }
}
