'use client'

import { SelectItem } from '@/components/ui/select'
import { Category } from '@/types'
import { categoryOptions } from '@/lib/category-tree'

interface Props {
  /** Categorias já filtradas (por tipo/data) que podem ser escolhidas. */
  list: Category[]
  /** Lista completa — usada para descobrir a mãe de cada subcategoria. */
  all: Category[]
  className?: string
  emptyLabel?: string
}

/**
 * Itens de um seletor de categoria: cada mãe seguida das suas subcategorias,
 * que aparecem recuadas e com o nome da mãe em cinza ("Alimentação › Mercado").
 * Um seletor só — antes eram dois, um para normais e outro para isoladas.
 */
export function CategoryOptions({ list, all, className, emptyLabel = 'Nenhuma categoria disponível' }: Props) {
  const options = categoryOptions(list, all)
  if (options.length === 0) {
    return <SelectItem value="__empty__" disabled className={className}>{emptyLabel}</SelectItem>
  }
  return (
    <>
      {options.map(({ cat, parentName }) => (
        <SelectItem key={cat.id} value={cat.name} className={className}>
          <span className="flex items-center gap-2">
            <span
              className={parentName ? 'h-2 w-2 rounded-full shrink-0 ml-3' : 'h-2.5 w-2.5 rounded-full shrink-0'}
              style={{ backgroundColor: cat.color }}
            />
            {parentName && <span className="text-slate-400 dark:text-slate-500 text-xs">{parentName} ›</span>}
            {cat.name}
          </span>
        </SelectItem>
      ))}
    </>
  )
}
