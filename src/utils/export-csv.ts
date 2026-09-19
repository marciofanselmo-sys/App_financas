import { Transaction, Category, AppEvent } from '@/types'
import { installmentLabel } from './format-installment'

const SEP = ';'

function escapeCell(value: string | number): string {
  const text = String(value)
  // Aspas duplas escapadas + sempre quotado: protege descrição/categoria
  // com ; , quebras de linha ou aspas — separador ; é o padrão do Excel BR.
  return `"${text.replace(/"/g, '""')}"`
}

function formatAmount(amount: number): string {
  // Vírgula decimal para abrir corretamente no Excel em pt-BR
  return amount.toFixed(2).replace('.', ',')
}

/**
 * Baixa as transações filtradas (as da tela) como CSV compatível com Excel BR.
 */
export function exportToCSV(
  transactions: Transaction[],
  filename = 'transacoes',
  // Sem estes, as colunas Categoria/Subcategoria/Evento saem em branco no que
  // depende deles — a transação guarda só o nome da categoria e o id do evento.
  categories: Category[] = [],
  events: AppEvent[] = [],
) {
  if (transactions.length === 0) return

  const catByName = new Map(categories.map(c => [c.name.trim().toLowerCase(), c]))
  const catById = new Map(categories.map(c => [c.id, c]))
  const eventById = new Map(events.map(e => [e.id, e]))

  // Categoria = a mãe; Subcategoria = o segundo nível, quando houver.
  function categoryCells(t: Transaction): [string, string] {
    const cat = catByName.get(t.category.trim().toLowerCase())
    if (!cat) return [t.category, '']
    const mother = cat.parent_id ? catById.get(cat.parent_id) : null
    return mother ? [mother.name, cat.name] : [cat.name, '']
  }

  const headers = [
    'Descrição',
    'Valor',
    'Data',
    'Parcelas',
    'Tipo',
    'Categoria',
    'Subcategoria',
    'Evento',
  ]

  const typeLabel = (t: Transaction) => (t.type === 'receita' ? 'Receita' : 'Despesa')

  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )

  const rows = sorted.map((t) => {
    const [categoria, subcategoria] = categoryCells(t)
    return [
      escapeCell(t.description),
      escapeCell(formatAmount(t.amount)),
      escapeCell(t.date),
      escapeCell(installmentLabel(t)),
      escapeCell(typeLabel(t)),
      escapeCell(categoria),
      escapeCell(subcategoria),
      escapeCell(t.event_id ? eventById.get(t.event_id)?.name ?? '' : ''),
    ]
  })

  const csv = [headers.join(SEP), ...rows.map((r) => r.join(SEP))].join('\n')

  // BOM UTF-8 para o Excel reconhecer acentos corretamente
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.style.display = 'none'
  // Alguns navegadores (Safari) só disparam o download com o <a> no DOM
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
