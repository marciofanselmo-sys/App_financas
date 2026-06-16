'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MoreVertical, Pencil, Trash2, Tag } from 'lucide-react'
import { Transaction } from '@/types'
import { useCategories } from '@/hooks/use-categories'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<{ error: unknown }>
}

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const { categories } = useCategories()
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  function getCategoryColor(name: string) {
    return categories.find(c => c.name === name)?.color ?? '#6b7280'
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await onDelete(deleteTarget.id)
    setDeleteTarget(null)
    setDeleting(false)
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhuma transação encontrada.</p>
        <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">Adicione sua primeira transação clicando no botão acima.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {transactions.map((tx) => {
          const catColor = getCategoryColor(tx.category)
          const isReceita = tx.type === 'receita'
          const dateFormatted = format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-xl px-4 py-3 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
            >
              {/* Ícone colorido da categoria */}
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: catColor + '20' }}
              >
                <Tag className="h-4 w-4" style={{ color: catColor }} />
              </div>

              {/* Descrição + categoria + data */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate"
                  title={tx.description}
                >
                  {tx.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span
                    className="text-xs font-medium"
                    style={{ color: catColor }}
                  >
                    {tx.category}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600 text-xs">·</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{dateFormatted}</span>
                </div>
              </div>

              {/* Tipo badge */}
              <Badge
                className={`text-xs shrink-0 border-0 hidden sm:inline-flex ${
                  isReceita
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {isReceita ? 'Receita' : 'Despesa'}
              </Badge>

              {/* Valor */}
              <p className={`font-bold text-sm shrink-0 ${isReceita ? 'text-green-600' : 'text-red-500'}`}>
                {isReceita ? '+' : '-'} {formatCurrency(Number(tx.amount))}
              </p>

              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(tx)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleteTarget(tx)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
            <DialogDescription>
              Excluir <strong>"{deleteTarget?.description}"</strong>? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
