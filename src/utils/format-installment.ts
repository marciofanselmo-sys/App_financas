import { Transaction } from '@/types'

// Rótulo de parcela "X de Y" pra exibir num campo próprio — string vazia se a
// transação não tem parcela detectada. Calculado na hora, nunca fica salvo no
// banco (guardar isso na descrição salva quebraria a regra automática de
// categoria e a correspondência de parcelas na importação, que dependem da
// descrição ser idêntica em todos os meses da mesma compra).
export function installmentLabel(
  tx: Pick<Transaction, 'installment_current' | 'installment_total'>
): string {
  if (tx.installment_total && tx.installment_total > 1 && tx.installment_current) {
    return `${tx.installment_current} de ${tx.installment_total}`
  }
  return ''
}
