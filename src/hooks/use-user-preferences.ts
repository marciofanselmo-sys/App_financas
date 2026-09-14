'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'

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
  const [loadError, setLoadError] = useState<string | null>(null)

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
      // Só 42P01 ("relation does not exist") significa tabela não migrada.
      //
      // Antes, QUALQUER erro caía aqui: falha de rede ou policy de RLS negando
      // leitura devolviam os padrões como se fossem as preferências do usuário.
      // O efeito visível era o % de investimento voltar para 20% sozinho, e a
      // próxima gravação salvar esse valor por cima do que o usuário escolheu.
      // (14.29)
      const notMigrated = error.code === '42P01'
      if (!notMigrated) {
        logSafeError('useUserPreferences.fetch', error)
        setLoadError('Não foi possível carregar suas preferências.')
        setLoading(false)
        return
      }

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
    loadError,
    updatePreferences,
    refetch: load,
  }
}
