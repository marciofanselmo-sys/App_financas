import { Transaction } from '@/types'

export interface DailyFlowPoint {
  day: number
  label: string
  key: string
  receita: number
  despesa: number
  receitaAcum: number
  despesaAcum: number
  saldoAcum: number
}

export function aggregateDailyFlow(
  transactions: Transaction[],
  month: number,
  year: number,
): DailyFlowPoint[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const points: DailyFlowPoint[] = []

  for (let day = 1; day <= daysInMonth; day++) {
    points.push({
      day,
      label: String(day),
      key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      receita: 0,
      despesa: 0,
      receitaAcum: 0,
      despesaAcum: 0,
      saldoAcum: 0,
    })
  }

  for (const t of transactions) {
    if (t.type === 'transferencia') continue
    const day = Number(t.date.slice(8, 10))
    const bucket = points[day - 1]
    if (!bucket) continue
    const amt = Number(t.amount)
    if (t.type === 'receita') bucket.receita += amt
    else bucket.despesa += amt
  }

  let receitaAcum = 0
  let despesaAcum = 0
  for (const p of points) {
    receitaAcum += p.receita
    despesaAcum += p.despesa
    p.receitaAcum = receitaAcum
    p.despesaAcum = despesaAcum
    p.saldoAcum = receitaAcum - despesaAcum
  }

  return points
}

export function hasDailyFlowActivity(points: DailyFlowPoint[]): boolean {
  return points.some(p => p.receita > 0 || p.despesa > 0)
}
