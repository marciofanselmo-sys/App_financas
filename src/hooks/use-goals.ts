'use client'

import { useState, useEffect } from 'react'
import { Goal } from '@/types'
import { createClient } from '@/lib/supabase/client'

function uid() {
  return crypto.randomUUID()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): Goal {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type ?? 'personalizada',
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    color: row.color,
    lastImport: row.last_import ?? undefined,
    created_at: row.created_at,
  }
}

function toRow(goal: Partial<Goal>) {
  const row: Record<string, unknown> = {}
  if (goal.name !== undefined)          row.name = goal.name
  if (goal.type !== undefined)          row.type = goal.type
  if (goal.targetAmount !== undefined)  row.target_amount = goal.targetAmount
  if (goal.currentAmount !== undefined) row.current_amount = goal.currentAmount
  if (goal.deadline !== undefined)      row.deadline = goal.deadline
  if (goal.color !== undefined)         row.color = goal.color
  if ('lastImport' in goal)             row.last_import = goal.lastImport ?? null
  return row
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchGoals() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    setGoals((data ?? []).map(fromRow))
    setLoading(false)
  }

  useEffect(() => { fetchGoals() }, [])

  async function createGoal(goal: Omit<Goal, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const id = uid()
    const created_at = new Date().toISOString()
    const row = {
      id,
      user_id: user.id,
      created_at,
      ...toRow(goal),
    }
    await supabase.from('goals').insert(row)
    setGoals(prev => [...prev, { ...goal, id, user_id: user.id, created_at }])
  }

  async function updateGoal(id: string, data: Partial<Omit<Goal, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    await supabase.from('goals').update(toRow(data)).eq('id', id)
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...data } : g)))
  }

  async function deleteGoal(id: string) {
    const supabase = createClient()
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  return { goals, loading, createGoal, updateGoal, deleteGoal }
}
