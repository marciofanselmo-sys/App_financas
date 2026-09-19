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

/**
 * Nome da categoria-mãe de cada categoria (a própria, quando ela já é mãe).
 * Chave em minúsculas — os lançamentos guardam o NOME da categoria, e é por
 * ele que os gráficos somam.
 */
export function motherNameByCategory(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map(c => [c.id, c]))
  const map = new Map<string, string>()
  for (const c of categories) {
    const parent = c.parent_id ? byId.get(c.parent_id) : null
    map.set(c.name.trim().toLowerCase(), parent?.name ?? c.name)
  }
  return map
}

/** Categoria-mãe de um nome de categoria; o próprio nome se não achar. */
export function motherOf(categoryName: string, map: Map<string, string>): string {
  return map.get(categoryName.trim().toLowerCase()) ?? categoryName
}
