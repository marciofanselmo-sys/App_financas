'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SuggestionStatus, UserSuggestion, validateSuggestionMessage } from '@/lib/suggestions'

export function useUserSuggestions() {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('user_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) setSuggestions(data as UserSuggestion[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submitSuggestion(rawMessage: string) {
    const validated = validateSuggestionMessage(rawMessage)
    if (!validated.ok) return { error: validated.error }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return { error: 'Faça login para enviar sugestões.' }

    const { data, error } = await supabase
      .from('user_suggestions')
      .insert({
        user_id: user.id,
        user_email: user.email,
        message: validated.message,
        status: 'nova' as SuggestionStatus,
      })
      .select()
      .single()

    if (error) return { error: error.message }
    if (data) setSuggestions(prev => [data as UserSuggestion, ...prev])
    return { data: data as UserSuggestion }
  }

  return { suggestions, loading, submitSuggestion, refetch: load }
}

export function useAdminSuggestions(enabled: boolean) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_suggestions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setSuggestions(data as UserSuggestion[])
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    load()
  }, [load])

  async function updateStatus(id: string, status: SuggestionStatus) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_suggestions')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) return { error: error.message }
    if (data) {
      setSuggestions(prev =>
        prev.map(s => (s.id === id ? (data as UserSuggestion) : s)),
      )
    }
    return { data: data as UserSuggestion }
  }

  return { suggestions, loading, updateStatus, refetch: load }
}
