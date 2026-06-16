import { Transaction } from '@/types'

export function exportToCSV(transactions: Transaction[], filename = 'transacoes') {
  const headers = ['Descrição', 'Valor', 'Data', 'Tipo', 'Categoria']

  const rows = transactions.map((t) => [
    `"${t.description.replace(/"/g, '""')}"`,
    String(t.amount),
    t.date,
    t.type === 'receita' ? 'Receita' : 'Despesa',
    t.category,
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
