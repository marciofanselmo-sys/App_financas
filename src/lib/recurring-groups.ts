import { RecurringItem } from '@/hooks/use-recurring'
import { TransactionType } from '@/types'

export interface DisplayItem {
  key: string
  name: string
  avgAmount: number
  monthsCount: number
  lastDate: string
  category: string
  subcategory: string | null
  type: TransactionType
  isGroup: boolean
  descriptions: string[]
  is_recurring: boolean
}

// A chave salva em recurring_decisions.description_key precisa continuar
// idêntica à de antes para despesas — é o único tipo que já existia quando a
// detecção começou, então mudar o formato faria confirmações/ignorados já
// salvos pelos usuários "sumirem". Receita e transferência são tipos novos
// aqui (nunca existiu linha salva pra eles), então ganham um prefixo próprio.
export function decisionKey(type: TransactionType, rawKey: string): string {
  return type === 'despesa' ? rawKey : `${type}:${rawKey}`
}

/**
 * `subcategoryNames`: nomes das categorias de segundo nível (Aluguel, Mercado...).
 * Quando o lançamento está numa delas, ela mesma agrupa as cobranças — é o que
 * o agrupador antigo (group_label) fazia à mão. Categoria principal (Moradia,
 * Outros) não agrupa: juntaria coisas que não têm relação.
 */
export function buildDisplayItems(
  recurring: RecurringItem[],
  overrides: Map<string, string | null>,
  subcategoryNames: Set<string> = new Set(),
): DisplayItem[] {
  // Aplica overrides locais antes de agrupar
  const withOverrides = recurring.map(r => ({
    ...r,
    group_label: overrides.has(r.description) ? overrides.get(r.description)! : r.group_label,
  }))

  const grouped = new Map<string, typeof withOverrides>()
  const singles: typeof withOverrides = []

  for (const r of withOverrides) {
    // A subcategoria vem primeiro: depois da conversão, group_label guarda o
    // grupo antigo, que virou categoria PRINCIPAL — agrupar por ele juntaria
    // Aluguel, Luz e Internet num card só.
    const subLabel = subcategoryNames.has(r.category) ? r.category : null
    const label = subLabel ?? (r.group_label?.trim() || null)
    if (label) {
      // Agrupa por tipo + subcategoria — uma despesa e uma receita não podem
      // cair no mesmo grupo só por coincidirem de subcategoria.
      const mapKey = `${r.type}|${label}`
      const existing = grouped.get(mapKey) ?? []
      existing.push(r)
      grouped.set(mapKey, existing)
    } else {
      singles.push(r)
    }
  }

  const items: DisplayItem[] = []

  for (const members of grouped.values()) {
    const first = members[0]
    const label = (subcategoryNames.has(first.category) ? first.category : first.group_label!).trim()
    const type = members[0].type
    // Meses distintos do grupo como um todo (não a soma dos meses de cada
    // descrição) — duas descrições que caem no mesmo mês não podem contar
    // esse mês duas vezes, senão a média mensal do grupo fica diluída pela
    // metade quando as descrições se sobrepõem (bug corrigido em 2026-07-09).
    const unionMonths = new Set(members.flatMap(r => r.months ?? []))
    const monthsCount = unionMonths.size
    const totalAmount = members.reduce((s, r) => s + r.avgAmount * r.monthsCount, 0)
    const avgAmount = monthsCount > 0 ? totalAmount / monthsCount : 0
    const lastDate = members.reduce((max, r) => r.lastDate > max ? r.lastDate : max, '')
    items.push({
      key: decisionKey(type, `group:${label}`),
      name: label,
      avgAmount,
      monthsCount,
      lastDate,
      category: members[0]?.category ?? '',
      subcategory: label,
      type,
      isGroup: true,
      descriptions: members.flatMap(r => r.descriptionVariants ?? [r.description]),
      is_recurring: members.some(r => r.is_recurring ?? false),
    })
  }

  for (const r of singles) {
    items.push({
      key: decisionKey(r.type, r.description.toLowerCase()),
      name: r.description,
      avgAmount: r.avgAmount,
      monthsCount: r.monthsCount,
      lastDate: r.lastDate,
      category: r.category,
      subcategory: r.group_label ?? null,
      type: r.type,
      isGroup: false,
      descriptions: r.descriptionVariants ?? [r.description],
      is_recurring: r.is_recurring ?? false,
    })
  }

  return items.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount)
}
