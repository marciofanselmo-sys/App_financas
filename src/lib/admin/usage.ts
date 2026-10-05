import type { AdminUser, UsageRow } from './types'

/** Uso de um cliente: contagens das tabelas principais e espaço estimado. */
export interface UsoCliente {
  user: AdminUser
  transacoes: number
  contas: number
  categorias: number
  regras: number
  importacoes: number
  bytes: number
}

/** Junta as linhas de admin_usage_by_user() por cliente, incluindo quem não tem nada. */
export function usoPorCliente(users: AdminUser[], rows: UsageRow[]): UsoCliente[] {
  const mapa = new Map<string, UsoCliente>(users.map(u => [u.id, {
    user: u, transacoes: 0, contas: 0, categorias: 0, regras: 0, importacoes: 0, bytes: 0,
  }]))
  for (const r of rows) {
    const c = mapa.get(r.uid)
    if (!c) continue
    const n = Number(r.row_count)
    if (r.table_name === '__imports') { c.importacoes = n; continue }
    c.bytes += Number(r.est_bytes)
    if (r.table_name === 'transactions') c.transacoes = n
    else if (r.table_name === 'transaction_boards') c.contas = n
    else if (r.table_name === 'categories') c.categorias = n
    else if (r.table_name === 'categorization_rules') c.regras = n
  }
  return [...mapa.values()].sort((a, b) => b.bytes - a.bytes)
}
