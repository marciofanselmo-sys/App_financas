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
