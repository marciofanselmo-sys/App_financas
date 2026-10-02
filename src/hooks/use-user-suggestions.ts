'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SuggestionKind, SuggestionStatus, UserSuggestion, validateSuggestionMessage } from '@/lib/suggestions'

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

  async function submitSuggestion(rawMessage: string, extra: { kind?: SuggestionKind; screen?: string } = {}) {
    const validated = validateSuggestionMessage(rawMessage)
    if (!validated.ok) return { error: validated.error }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return { error: 'Faça login para enviar sugestões.' }

    const base = {
      user_id: user.id,
      user_email: user.email,
      message: validated.message,
      status: 'nova' as SuggestionStatus,
    }
    let { data, error } = await supabase
      .from('user_suggestions')
      .insert({ ...base, kind: extra.kind ?? 'ideia', screen: extra.screen || null })
      .select()
      .single()
    // Banco ainda sem as colunas de tipo/tela (migração pendente): envia só a
    // mensagem, para a sugestão nunca se perder.
    if (error && (error.code === 'PGRST204' || /kind|screen/.test(error.message))) {
      ;({ data, error } = await supabase.from('user_suggestions').insert(base).select().single())
    }

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

  async function updateReply(id: string, reply: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_suggestions')
      .update({ admin_reply: reply.trim() || null })
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

  return { suggestions, loading, updateStatus, updateReply, refetch: load }
}
