'use client'

import { useMemo } from 'react'
import { useCategories } from '@/hooks/use-categories'

/**
 * Nomes das categorias de segundo nível (Aluguel, Mercado, Streaming...).
 * Recorrências usa esse conjunto para juntar num card só as cobranças que
 * caem na mesma subcategoria, mesmo com descrições diferentes no extrato.
 */
export function useSubcategoryNames(): Set<string> {
  const { categories } = useCategories()
  return useMemo(
    () => new Set(categories.filter(c => c.parent_id).map(c => c.name)),
    [categories],
  )
}
