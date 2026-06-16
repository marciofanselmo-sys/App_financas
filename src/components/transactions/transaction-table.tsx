'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Transaction } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<{ error: unknown }>
}

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deleteId) return
    setDeleting(true)
    await onDelete(deleteId)
    setDeleteId(null)
    setDeleting(false)
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-slate-400 text-sm">Nenhuma transação encontrada.</p>
        <p className="text-slate-300 text-xs mt-1">Adicione sua primeira transação clicando no botão acima.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-slate-100 overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-xs font-semibold text-slate-500">Descrição</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 hidden sm:table-cell">Categoria</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 hidden md:table-cell">Data</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 text-right">Valor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id} className="hover:bg-slate-50/50">
                <TableCell className="font-medium text-slate-700 text-sm">{tx.description}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tx.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500 text-sm hidden md:table-cell">
                  {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`text-xs ${
                      tx.type === 'receita'
                        ? 'bg-green-50 text-green-700 hover:bg-green-50'
                        : 'bg-red-50 text-red-600 hover:bg-red-50'
                    }`}
                    variant="outline"
                  >
                    {tx.type === 'receita' ? 'Receita' : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  <span className={tx.type === 'receita' ? 'text-green-600' : 'text-red-500'}>
                    {tx.type === 'despesa' ? '- ' : '+ '}
                    {formatCurrency(Number(tx.amount))}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 transition-colors">
                      <MoreVertical className="h-4 w-4 text-slate-500" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(tx)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(tx.id)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. A transação será removida permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
