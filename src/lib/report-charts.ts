import { Transaction } from '@/types'

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface YearMonthPoint {
  month: number
  label: string
  receita: number
  despesa: number
  saldo: number
}

export function aggregateYearMonths(transactions: Transaction[]): YearMonthPoint[] {
  const map = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: MONTH_LABELS[i],
    receita: 0,
    despesa: 0,
    saldo: 0,
  }))

  for (const t of transactions) {
    if (t.type === 'transferencia') continue
    const m = new Date(`${t.date}T12:00:00`).getMonth()
    const amt = Number(t.amount)
    if (t.type === 'receita') map[m].receita += amt
    else map[m].despesa += amt
  }

  map.forEach(m => { m.saldo = m.receita - m.despesa })
  return map
}

export interface YoYBalancePoint {
  label: string
  month: number
  atual: number
  anterior: number
}

export function buildYoYBalanceComparison(
  currentYear: YearMonthPoint[],
  previousYear: YearMonthPoint[],
): YoYBalancePoint[] {
  return currentYear.map((curr, i) => ({
    label: curr.label,
    month: curr.month,
    atual: curr.saldo,
    anterior: previousYear[i]?.saldo ?? 0,
  }))
}

export function buildYoYIncomeComparison(
  currentYear: YearMonthPoint[],
  previousYear: YearMonthPoint[],
): YoYBalancePoint[] {
  return currentYear.map((curr, i) => ({
    label: curr.label,
    month: curr.month,
    atual: curr.receita,
    anterior: previousYear[i]?.receita ?? 0,
  }))
}
