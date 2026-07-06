import { Category, TransactionType } from '@/types'

// Categoria especial só é uma opção válida para transações cuja data caia em
// algum dos meses/anos configurados nela. Categorias normais (special_dates
// vazio) sempre valem.
export function isCategoryUsableForDate(cat: Category, dateStr: string): boolean {
  if (!cat.special_dates || cat.special_dates.length === 0) return true
  if (!dateStr) return false
  const [year, month] = dateStr.split('-').map(Number)
  return cat.special_dates.some(d => d.month === month && d.year === year)
}

export function categoriesForDate(categories: Category[], dateStr: string): Category[] {
  return categories.filter(c => isCategoryUsableForDate(c, dateStr))
}

// Para contextos não presos a uma transação específica (ex: regras que não têm
// uma data fixa de referência).
export function nonSpecialCategories(categories: Category[]): Category[] {
  return categories.filter(c => !c.special_dates || c.special_dates.length === 0)
}

// Para seleção em massa: uma categoria só é uma opção válida se TODAS as
// transações selecionadas tiverem o mesmo tipo dela (ou ela for "ambos") e
// data dentro de algum mês configurado (se for categoria especial). Sem o
// filtro de tipo, selecionar uma despesa e uma transferência juntas deixava
// aplicar uma categoria de receita nas duas, por exemplo.
export function categoriesForTransactions(
  categories: Category[],
  transactions: { date: string; type: TransactionType }[],
): Category[] {
  if (transactions.length === 0) return nonSpecialCategories(categories)
  return categories.filter(c =>
    transactions.every(t => (c.type === t.type || c.type === 'ambos') && isCategoryUsableForDate(c, t.date))
  )
}
