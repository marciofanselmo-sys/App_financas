// category_limits (budget_plans) é um JSONB livre — subcategorias entram nele
// com essa chave prefixada, pra não colidir com nomes de categoria e sem
// precisar de migração. Compartilhado entre /planning e /reports.
export const SUB_PREFIX = 'sub:'
export const subKey = (name: string) => `${SUB_PREFIX}${name}`
export const isSubKey = (key: string) => key.startsWith(SUB_PREFIX)
export const subName = (key: string) => key.slice(SUB_PREFIX.length)
