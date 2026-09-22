import { Category, TransactionType } from '@/types'

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

const key = (name: string) => name.trim().toLowerCase()

/**
 * Nome da categoria-mãe de cada categoria (a própria, quando ela já é mãe).
 * Os lançamentos guardam só o NOME, então a chave é o nome — e, quando o
 * mesmo nome existe em Despesa e em Receita (permitido de propósito), a
 * chave "tipo|nome" desempata.
 */
export function motherNameByCategory(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map(c => [c.id, c]))
  const map = new Map<string, string>()
  for (const c of categories) {
    const mother = (c.parent_id ? byId.get(c.parent_id)?.name : null) ?? c.name
    map.set(`${c.type}|${key(c.name)}`, mother)
    // Sem tipo: a primeira vence, e "ambos" (legado) cobre os dois.
    if (!map.has(key(c.name)) || c.type === 'ambos') map.set(key(c.name), mother)
  }
  return map
}

/**
 * Categoria-mãe de um nome; o próprio nome se não achar. `type` é o tipo do
 * LANÇAMENTO — é ele que decide qual das categorias de mesmo nome vale.
 */
export function motherOf(categoryName: string, map: Map<string, string>, type?: TransactionType): string {
  const k = key(categoryName)
  if (type) {
    const exact = map.get(`${type}|${k}`) ?? map.get(`ambos|${k}`)
    if (exact) return exact
  }
  return map.get(k) ?? categoryName
}

/** A categoria certa para um nome + tipo de lançamento. */
export function findCategory(categories: Category[], name: string, type?: TransactionType): Category | null {
  const k = key(name)
  const sameName = categories.filter(c => key(c.name) === k)
  if (sameName.length === 0) return null
  if (!type) return sameName[0]
  return sameName.find(c => c.type === type) ?? sameName.find(c => c.type === 'ambos') ?? sameName[0]
}
