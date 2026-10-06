import { CategorizationRule, matchesRule } from '@/hooks/use-rules'

/**
 * Faxina das regras de categoria — só aponta, nunca age sozinha.
 *
 * Toda recategorização cria uma regra exata pela descrição (syncCategoryToRule),
 * então quem categoriza delivery um por um acaba com "IFOOD *PIZZARIA X",
 * "IFOOD *SUSHI Y"... uma regra por restaurante. Aqui o app enxerga isso e
 * sugere; o usuário decide na tela de Regras (Vale revisar).
 *
 * Só regras AUTOMÁTICAS, de categoria e sem conta de destino entram como
 * candidatas a excluir/juntar: regra manual é escolha do usuário, e regra que
 * move o lançamento de conta faz mais do que categorizar.
 */

const isCandidate = (r: CategorizationRule) =>
  r.active && !!r.auto_created && r.match_type === 'exact' && !r.board_id

/**
 * Regras repetidas: automáticas exatas que outra regra ATIVA, mais geral e com
 * a MESMA categoria, já cobre. Excluir não muda a categoria de nada — a outra
 * continua pegando os mesmos lançamentos.
 * Devolve id da repetida → a regra que a cobre.
 */
export function findRedundantRules(rules: CategorizationRule[]): Map<string, CategorizationRule> {
  const out = new Map<string, CategorizationRule>()
  const generals = rules.filter(r => r.active && r.match_type !== 'exact' && !r.board_id)
  for (const r of rules) {
    if (!isCandidate(r)) continue
    const cover = generals.find(g => g.id !== r.id && g.category === r.category && matchesRule(r.keyword, g))
    if (cover) out.set(r.id, cover)
  }
  return out
}

export interface MergeGroup {
  /** Texto antes do "*", que vira a regra "Começa com". */
  prefix: string
  category: string
  rules: CategorizationRule[]
}

/** Mínimo de regras para sugerir juntar — menos que isso não vale a pena. */
const MIN_GROUP = 3

/**
 * Grupos que podem virar uma regra "Começa com": automáticas exatas com o
 * mesmo prefixo antes do "*" (padrão das maquininhas e apps: "IFOOD *LOJA",
 * "UBER *TRIP", "MP *VENDEDOR") e a mesma categoria. O "*" é a garantia de
 * que o prefixo é o nome do app/intermediador, não coincidência de texto.
 */
export function findMergeGroups(rules: CategorizationRule[], redundant: Map<string, CategorizationRule>): MergeGroup[] {
  const groups = new Map<string, MergeGroup>()
  for (const r of rules) {
    if (!isCandidate(r) || redundant.has(r.id)) continue
    const star = r.keyword.indexOf('*')
    if (star < 0) continue
    const prefix = r.keyword.slice(0, star).trim().toUpperCase()
    if (prefix.length < 3) continue
    const key = `${prefix}|${r.category}`
    const g = groups.get(key) ?? { prefix, category: r.category, rules: [] }
    g.rules.push(r)
    groups.set(key, g)
  }
  return [...groups.values()]
    .filter(g => g.rules.length >= MIN_GROUP)
    .sort((a, b) => b.rules.length - a.rules.length)
}
