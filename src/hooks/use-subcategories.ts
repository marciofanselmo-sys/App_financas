'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { selectAllPages } from '@/lib/supabase/select-all'
import { logSafeError } from '@/lib/supabase-error'
import { Subcategory, TransactionType } from '@/types'

/**
 * Grupos antigos de recorrência (o "subcategoria" de antes), guardados em
 * user_metadata. Só existem para oferecer a conversão para o modelo
 * Categoria > Subcategoria a quem ainda não converteu — ver
 * src/lib/category-conversion.ts.
 *
 * Somente leitura, de propósito: a versão antiga também escrevia
 * `group_label` e `is_recurring` nas transações a cada carregamento da
 * página, que é justamente o acoplamento que o modelo novo desfez (estar numa
 * categoria não significa ser gasto fixo).
 */
export function useSubcategories() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const rawMeta = (user.user_metadata?.subcategories as unknown[] | undefined) ?? []

    const { rows: txRows, error: txError } = await selectAllPages<{
      group_label: string | null; type: string; category: string | null
    }>(() => supabase
      .from('transactions')
      .select('group_label, type, category')
      .eq('user_id', user.id)
      .not('group_label', 'is', null))

    if (txError) logSafeError('useSubcategories.load', txError)

    // Formato antigo (string pura, sem tipo nem categorias): completa com o
    // que as transações do grupo mostram, só em memória.
    const categoriesByLabel = new Map<string, Set<string>>()
    const votes = new Map<string, Record<string, number>>()
    for (const row of txRows) {
      const label = row.group_label
      if (!label) continue
      if (row.category) {
        if (!categoriesByLabel.has(label)) categoriesByLabel.set(label, new Set())
        categoriesByLabel.get(label)!.add(row.category)
      }
      const v = votes.get(label) ?? {}
      v[row.type] = (v[row.type] ?? 0) + 1
      votes.set(label, v)
    }
    const inferType = (label: string): TransactionType => {
      const v = votes.get(label)
      if (!v) return 'despesa'
      return (Object.entries(v).sort((a, b) => b[1] - a[1])[0][0] as TransactionType) ?? 'despesa'
    }

    const list: Subcategory[] = rawMeta.map(item => {
      if (typeof item === 'string') {
        return { name: item, type: inferType(item), categories: [...(categoriesByLabel.get(item) ?? [])] }
      }
      const sub = item as Subcategory
      return { ...sub, categories: sub.categories ?? [...(categoriesByLabel.get(sub.name) ?? [])] }
    })

    // Rótulos que existem nas transações mas nunca foram criados formalmente.
    const known = new Set(list.map(s => s.name))
    for (const label of categoriesByLabel.keys()) {
      if (!known.has(label)) {
        list.push({ name: label, type: inferType(label), categories: [...(categoriesByLabel.get(label) ?? [])] })
      }
    }

    setSubcategories(list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { subcategories, loading, refetch: load }
}
