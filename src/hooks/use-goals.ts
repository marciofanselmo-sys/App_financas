'use client'

import { useState, useEffect } from 'react'
import { Goal } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { formatUserError, logSafeError } from '@/lib/supabase-error'

export type GoalResult = { error: string | null }

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
  if (goal.created_at !== undefined)    row.created_at = goal.created_at
  if ('lastImport' in goal)             row.last_import = goal.lastImport ?? null
  return row
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  // Toda escrita checa o { error } do Postgres antes de mexer no estado local.
  // Antes o estado era atualizado incondicionalmente: uma recusa do banco (RLS,
  // coluna faltando, rede) deixava a meta na tela como se tivesse salvo, e ela
  // sumia no primeiro F5 — sem nenhum aviso ao usuário.
  const [error, setError] = useState<string | null>(null)

  async function fetchGoals() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchError) {
      logSafeError('useGoals.fetch', fetchError)
      setError(formatUserError(fetchError, 'Erro ao carregar suas metas.'))
      setLoading(false)
      return
    }

    setGoals((data ?? []).map(fromRow))
    setLoading(false)
  }

  useEffect(() => { fetchGoals() }, [])

  function fail(context: string, cause: unknown, fallback: string): GoalResult {
    logSafeError(context, cause)
    const message = formatUserError(cause, fallback)
    setError(message)
    return { error: message }
  }

  function notAuthenticated(): GoalResult {
    const message = 'Sessão expirada. Entre novamente.'
    setError(message)
    return { error: message }
  }

  // created_at é editável pelo usuário (data "meta iniciada em", usada no
  // cálculo de ritmo) — se não vier informado, usa o momento da criação, igual
  // sempre foi.
  async function createGoal(goal: Omit<Goal, 'id' | 'user_id' | 'created_at'> & { created_at?: string }): Promise<GoalResult> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return notAuthenticated()

    const id = uid()
    const created_at = goal.created_at ?? new Date().toISOString()
    const row = {
      id,
      user_id: user.id,
      ...toRow(goal),
      created_at,
    }
    const { error: insertError } = await supabase.from('goals').insert(row)
    if (insertError) return fail('useGoals.create', insertError, 'Erro ao criar a meta.')

    setGoals(prev => [...prev, { ...goal, id, user_id: user.id, created_at }])
    setError(null)
    return { error: null }
  }

  async function updateGoal(id: string, data: Partial<Omit<Goal, 'id' | 'user_id'>>): Promise<GoalResult> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return notAuthenticated()
    // Filtro por user_id explícito, não só RLS — defesa em profundidade,
    // no mesmo padrão do resto do app (ex: use-recurring-decisions.ts).
    const { error: updateError } = await supabase.from('goals').update(toRow(data)).eq('id', id).eq('user_id', user.id)
    if (updateError) return fail('useGoals.update', updateError, 'Erro ao salvar a meta.')

    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...data } : g)))
    setError(null)
    return { error: null }
  }

  async function deleteGoal(id: string): Promise<GoalResult> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return notAuthenticated()
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id)
    if (deleteError) return fail('useGoals.delete', deleteError, 'Erro ao excluir a meta.')

    setGoals(prev => prev.filter(g => g.id !== id))
    setError(null)
    return { error: null }
  }

  return { goals, loading, error, clearError: () => setError(null), createGoal, updateGoal, deleteGoal }
}
