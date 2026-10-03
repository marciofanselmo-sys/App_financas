import { Transaction } from '@/types'
import { extractInstallment } from '@/hooks/use-recurring'

// Visão histórica das compras parceladas (Relatório de Parcelas): cada compra
// vira um registro com valor cheio, mês de início e situação — o que a tela
// Cartões & Parcelas não mostra, porque ela olha só para o que falta pagar.

export interface InstallmentPurchase {
  key: string
  description: string
  category: string
  monthly: number
  total: number          // nº de parcelas
  full: number           // valor cheio da compra
  startIdx: number       // ano*12 + mês(0-11) da 1ª parcela
  paidNow: number        // parcelas já vencidas até hoje
}

export const monthIdx = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return y * 12 + (m - 1)
}

/** Agrupa os lançamentos parcelados em compras (descrição + nº de parcelas + valor + conta). */
export function buildPurchases(transactions: Transaction[], todayISO: string): InstallmentPurchase[] {
  const today = monthIdx(todayISO)
  const map = new Map<string, InstallmentPurchase>()
  for (const t of transactions) {
    if (t.type !== 'despesa') continue
    const inst = extractInstallment(t)
    if (!inst) continue
    const amount = Number(t.amount)
    const key = `${inst.base.toLowerCase().trim()}|${inst.total}|${amount.toFixed(2)}|${t.board_id ?? ''}`
    const start = monthIdx(t.date) - (inst.current - 1)
    if (!map.has(key)) {
      map.set(key, {
        key, description: inst.base, category: t.category, monthly: amount, total: inst.total,
        full: amount * inst.total, startIdx: start, paidNow: Math.max(0, Math.min(inst.total, today - start + 1)),
      })
    }
  }
  return [...map.values()]
}
