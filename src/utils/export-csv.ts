import { Transaction } from '@/types'
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
export function exportToCSV(transactions: Transaction[], filename = 'transacoes') {
  if (transactions.length === 0) return

  const headers = [
    'Descrição',
    'Valor',
    'Data',
    'Parcelas',
    'Tipo',
    'Categoria',
    'Subcategoria',
  ]

  const typeLabel = (type: Transaction['type']) =>
    type === 'receita' ? 'Receita' : type === 'transferencia' ? 'Transferência' : 'Despesa'

  const sorted = [...transactions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )

  const rows = sorted.map((t) => [
    escapeCell(t.description),
    escapeCell(formatAmount(t.amount)),
    escapeCell(t.date),
    escapeCell(installmentLabel(t)),
    escapeCell(typeLabel(t.type)),
    escapeCell(t.category),
    escapeCell(t.group_label ?? ''),
  ])

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
