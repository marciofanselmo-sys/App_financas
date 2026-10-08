'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AdminUser, CaktoEvent, UsageRow } from '@/lib/admin/types'

/**
 * Dados do painel Admin que mais de uma aba usa. Cada fonte é buscada uma vez
 * por "rodada" (refreshKey): trocar de aba reaproveita o que já veio, e o
 * botão Atualizar do painel começa uma rodada nova.
 */
type Resultado<T> = { data: T | null; error: string | null }
/** fetchedAt: quando os dados chegaram — a referência de "agora" para as contas das abas. */
type Estado<T> = Resultado<T> & { loading: boolean; fetchedAt: number }

const cache = new Map<string, Promise<Resultado<unknown>>>()

function useAdminFetch<T>(nome: string, refreshKey: number, buscar: () => Promise<Resultado<T>>) {
  const [estado, setEstado] = useState<Estado<T>>({ data: null, error: null, loading: true, fetchedAt: 0 })

  useEffect(() => {
    let vivo = true
    const chave = `${nome}#${refreshKey}`
    if (!cache.has(chave)) cache.set(chave, buscar())
    setEstado(e => ({ ...e, loading: true }))
    ;(cache.get(chave) as Promise<Resultado<T>>).then(r => {
      if (vivo) setEstado({ ...r, loading: false, fetchedAt: Date.now() })
    })
    return () => { vivo = false }
  }, [nome, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return estado
}

async function getJson<T>(url: string, campo: string): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: body.error ?? `erro ${res.status}` }
    return { data: body[campo] as T, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'falha de rede' }
  }
}

export function useAdminUsers(refreshKey: number) {
  return useAdminFetch<AdminUser[]>('users', refreshKey, () => getJson('/api/admin/users', 'users'))
}

export function useCaktoEvents(refreshKey: number) {
  return useAdminFetch<CaktoEvent[]>('billing', refreshKey, () => getJson('/api/admin/billing', 'events'))
}

/** Linhas por cliente e tabela. Erro aqui quase sempre é a migration não rodada. */
export function useUsageByUser(refreshKey: number) {
  return useAdminFetch<UsageRow[]>('usage', refreshKey, async () => {
    const { data, error } = await createClient().rpc('admin_usage_by_user')
    return { data: (data as UsageRow[] | null) ?? null, error: error?.message ?? null }
  })
}

/** Tamanho real do banco em bytes. */
export function useDbSize(refreshKey: number) {
  return useAdminFetch<number>('dbsize', refreshKey, async () => {
    const { data, error } = await createClient().rpc('admin_db_size')
    return { data: data == null ? null : Number(data), error: error?.message ?? null }
  })
}

export interface ProductEventRow { user_id: string; event: string; dedupe_key: string; created_at: string; props?: Record<string, unknown> | null }

/** Marcos da jornada (product_events). Erro = migration_product_events.sql ainda não rodou. */
export function useProductEvents(refreshKey: number) {
  return useAdminFetch<ProductEventRow[]>('product_events', refreshKey, async () => {
    const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await createClient()
      .from('product_events')
      .select('user_id, event, dedupe_key, created_at, props')
      .gte('created_at', desde)
      .limit(20000)
    return { data: (data as ProductEventRow[] | null) ?? null, error: error?.message ?? null }
  })
}
