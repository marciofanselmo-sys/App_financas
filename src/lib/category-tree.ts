import { Category } from '@/types'

export interface CategoryOption {
  cat: Category
  /** Nome da categoria-mãe, quando esta é uma subcategoria. */
  parentName: string | null
}

/**
 * Ordena categorias para um seletor: cada mãe seguida das suas subcategorias,
 * em ordem alfabética, com "Outros" por último. `all` é a lista completa —
 * precisa dela para achar a mãe de uma subcategoria mesmo quando a mãe foi
 * filtrada fora (ex.: filtro por tipo).
 */
export function categoryOptions(list: Category[], all: Category[]): CategoryOption[] {
  const byId = new Map(all.map(c => [c.id, c]))
  const isOutros = (name: string) => name.trim().toLowerCase() === 'outros'

  return list
    .map(cat => {
      const parent = cat.parent_id ? byId.get(cat.parent_id) ?? null : null
      return { cat, parentName: parent?.name ?? null, groupName: parent?.name ?? cat.name }
    })
    .sort((a, b) => {
      if (isOutros(a.groupName) !== isOutros(b.groupName)) return isOutros(a.groupName) ? 1 : -1
      const g = a.groupName.localeCompare(b.groupName, 'pt-BR')
      if (g !== 0) return g
      // Dentro do grupo, a mãe vem antes das filhas.
      if (!a.parentName !== !b.parentName) return a.parentName ? 1 : -1
      return a.cat.name.localeCompare(b.cat.name, 'pt-BR')
    })
    .map(({ cat, parentName }) => ({ cat, parentName }))
}

/** "Alimentação › Mercado" — para texto corrido (avisos, exportação). */
export function categoryFullName(cat: Category, all: Category[]): string {
  const parent = cat.parent_id ? all.find(c => c.id === cat.parent_id) : null
  return parent ? `${parent.name} › ${cat.name}` : cat.name
}
