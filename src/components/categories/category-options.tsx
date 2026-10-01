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
 * recuadas logo abaixo dela. A mãe não se repete em cada subcategoria — isso
 * comia o espaço e cortava o nome da subcategoria nos seletores estreitos.
 * Um seletor só — antes eram dois, um para normais e outro para isoladas.
 */
export function CategoryOptions({ list, all, className, emptyLabel = 'Nenhuma categoria disponível' }: Props) {
  const options = categoryOptions(list, all)
  // Mãe fora da lista (outro tipo, por exemplo): aí o nome dela continua na
  // frente, senão a subcategoria ficaria solta sob a categoria errada.
  const listed = new Set(options.map(o => o.cat.id))
  if (options.length === 0) {
    return <SelectItem value="__empty__" disabled className={className}>{emptyLabel}</SelectItem>
  }
  return (
    <>
      {options.map(({ cat, parentName }) => (
        <SelectItem key={cat.id} value={cat.name} className={className}>
          <span className={parentName ? 'flex items-center gap-2 pl-4' : 'flex items-center gap-2 font-medium'}>
            <span
              className={parentName ? 'h-1.5 w-1.5 rounded-full shrink-0' : 'h-2.5 w-2.5 rounded-full shrink-0'}
              style={{ backgroundColor: cat.color }}
            />
            {parentName && !listed.has(cat.parent_id ?? '') && (
              <span className="text-slate-400 dark:text-slate-500 text-xs">{parentName} ›</span>
            )}
            {cat.name}
          </span>
        </SelectItem>
      ))}
    </>
  )
}
