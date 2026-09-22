import { Transaction } from '@/types'

/**
 * Movimentação entre as contas do próprio usuário — pagamento de fatura,
 * PIX de uma conta dele para outra. O dinheiro muda de lugar, mas não é
 * gasto nem ganho: contar isso como despesa/receita infla os dois lados.
 *
 * Duas marcas identificam essas linhas, as duas já existentes no banco:
 *   counterpart_board_id → a conta que este lançamento quitou/abasteceu
 *   counterpart_of_id    → a perna que o app gerou do outro lado
 *
 * O saldo da conta e o patrimônio CONTINUAM contando: o dinheiro saiu da
 * conta corrente e abateu a fatura de verdade. Quem não conta é o total de
 * gastos e de entradas (Análise, Relatórios, Dashboard, Planejamento).
 *
 * A marca é POR LANÇAMENTO, nunca pelo par: o usuário pode querer que a saída
 * não conte como gasto e que a entrada do outro lado continue contando como
 * receita — é o caso do PIX da conta PJ para a conta pessoal, que é despesa
 * nenhuma para ele, mas é renda de verdade quando chega.
 */
export function isInternalMovement(t: Pick<Transaction, 'counterpart_board_id' | 'counterpart_of_id'>): boolean {
  return !!t.counterpart_board_id || !!t.counterpart_of_id
}

/** Só o que é gasto/ganho de verdade. */
export function realMovements<T extends Pick<Transaction, 'counterpart_board_id' | 'counterpart_of_id'>>(list: T[]): T[] {
  return list.filter(t => !isInternalMovement(t))
}

export interface InternalTotals {
  out: number   // saiu de uma conta para outra
  in: number    // entrou vindo de outra conta sua
  count: number
}

export function internalTotals(transactions: Transaction[]): InternalTotals {
  let out = 0, inc = 0, count = 0
  for (const t of transactions) {
    if (!isInternalMovement(t)) continue
    count++
    if (t.type === 'despesa') out += Number(t.amount)
    else inc += Number(t.amount)
  }
  return { out, in: inc, count }
}
