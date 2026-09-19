'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'
import { AppEvent } from '@/types'

// Eventos (ex.: "Viagem Rio"): etiqueta por cima da categoria. O lançamento
// continua em Alimentação/Transporte… e também soma no evento.
export function useEvents() {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) logSafeError('useEvents.load', error)
    setEvents((data ?? []) as AppEvent[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createEvent(input: { name: string; color: string }) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }
    const name = input.name.trim()
    if (events.some(e => e.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'Já existe um evento com esse nome.' }
    }
    const { data, error } = await supabase
      .from('events')
      .insert({ user_id: user.id, name, color: input.color })
      .select('*')
      .single()
    if (error) { logSafeError('useEvents.create', error); return { error: error.message } }
    setEvents(prev => [data as AppEvent, ...prev])
    return { error: null }
  }

  async function updateEvent(id: string, patch: Partial<Pick<AppEvent, 'name' | 'color' | 'closed'>>) {
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      if (events.some(e => e.id !== id && e.name.toLowerCase() === name.toLowerCase())) {
        return { error: 'Já existe um evento com esse nome.' }
      }
      patch = { ...patch, name }
    }
    const { error } = await createClient().from('events').update(patch).eq('id', id)
    if (error) { logSafeError('useEvents.update', error); return { error: error.message } }
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
    return { error: null }
  }

  // Os lançamentos NÃO são apagados: o banco só desmarca o evento deles
  // (transactions.event_id on delete set null).
  async function deleteEvent(id: string) {
    const { error } = await createClient().from('events').delete().eq('id', id)
    if (error) { logSafeError('useEvents.delete', error); return { error: error.message } }
    setEvents(prev => prev.filter(e => e.id !== id))
    return { error: null }
  }

  return { events, loading, refetch: load, createEvent, updateEvent, deleteEvent }
}
