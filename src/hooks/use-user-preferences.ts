'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UserPreferences {
  id: string
  user_id: string
  investment_pct: number
  theme: 'light' | 'dark' | 'system'
  default_board_id: string | null
  created_at: string
  updated_at: string
}

const DEFAULT_PREFERENCES: Pick<UserPreferences, 'investment_pct' | 'theme' | 'default_board_id'> = {
  investment_pct: 20,
  theme: 'system',
  default_board_id: null,
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPreferences(null)
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // Tabela ainda não migrada — fallback local até rodar SQL
      setPreferences({
        id: '',
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
        created_at: '',
        updated_at: '',
      })
      setLoading(false)
      return
    }

    if (data) {
      setPreferences(data)
    } else {
      setPreferences({
        id: '',
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
        created_at: '',
        updated_at: '',
      })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function updatePreferences(
    patch: Partial<Pick<UserPreferences, 'investment_pct' | 'theme' | 'default_board_id'>>,
  ) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const payload = {
      user_id: user.id,
      investment_pct: patch.investment_pct ?? preferences?.investment_pct ?? DEFAULT_PREFERENCES.investment_pct,
      theme: patch.theme ?? preferences?.theme ?? DEFAULT_PREFERENCES.theme,
      default_board_id: patch.default_board_id !== undefined
        ? patch.default_board_id
        : (preferences?.default_board_id ?? null),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (data) setPreferences(data)
    return { error, data }
  }

  return {
    preferences,
    defaultInvestmentPct: preferences?.investment_pct ?? DEFAULT_PREFERENCES.investment_pct,
    loading,
    updatePreferences,
    refetch: load,
  }
}
