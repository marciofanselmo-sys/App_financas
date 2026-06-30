'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MoreVertical, Pencil, Trash2, ArrowRightLeft, RefreshCw } from 'lucide-react'
import { Transaction, TransactionBoard } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface TransactionTableProps {
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => Promise<{ error: unknown }>
  onMove?: (txId: string, boardId: string) => Promise<{ error: unknown }>
  onToggleRecurring?: (tx: Transaction) => Promise<void>
  boards?: TransactionBoard[]
  currentBoardId?: string
}

export function TransactionTable({ transactions, onEdit, onDelete, onMove, onToggleRecurring, boards, currentBoardId }: TransactionTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [moveTx, setMoveTx] = useState<Transaction | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [moving, setMoving] = useState(false)

  const otherBoards = (boards ?? []).filter(b => b.id !== currentBoardId)

  async function confirmMove() {
    if (!moveTx || !selectedBoardId || !onMove) return
    setMoving(true)
    await onMove(moveTx.id, selectedBoardId)
    setMoveTx(null)
    setSelectedBoardId('')
    setMoving(false)
  }

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
        <p className="text-slate-400 dark:text-slate-500 text-sm">Nenhuma transação encontrada.</p>
        <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">Adicione sua primeira transação clicando no botão acima.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-700/50">
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell w-28">Categoria</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell w-36">Data</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell w-28">Recorrência</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-24">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right w-28">Valor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                <TableCell className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate overflow-hidden">{tx.description}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tx.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell">
                  {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {onToggleRecurring && (
                    <button
                      title={tx.is_recurring ? 'Remover da aba Recorrências' : 'Adicionar à aba Recorrências'}
                      disabled={togglingId === tx.id}
                      onClick={async () => {
                        setTogglingId(tx.id)
                        await onToggleRecurring(tx)
                        setTogglingId(null)
                      }}
                      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-colors ${
                        tx.is_recurring
                          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 hover:bg-violet-200 dark:hover:bg-violet-900/60'
                          : 'text-slate-400 border-dashed border-slate-300 dark:border-slate-600 hover:text-violet-500 hover:border-violet-300'
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${togglingId === tx.id ? 'animate-spin' : ''}`} />
                      {tx.is_recurring ? 'Fixo' : 'Fixar'}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`text-xs ${
                      tx.type === 'receita'
                        ? 'bg-green-50 text-green-700 hover:bg-green-50'
                        : tx.type === 'transferencia'
                          ? 'bg-slate-100 text-slate-500 hover:bg-slate-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-50'
                    }`}
                    variant="outline"
                  >
                    {tx.type === 'receita' ? 'Receita' : tx.type === 'transferencia' ? 'Transferência' : 'Despesa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  <span className={tx.type === 'receita' ? 'text-green-600' : tx.type === 'transferencia' ? 'text-slate-400' : 'text-red-500'}>
                    {tx.type === 'despesa' ? '- ' : tx.type === 'transferencia' ? '' : '+ '}
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
                      {onMove && otherBoards.length > 0 && (
                        <DropdownMenuItem onClick={() => { setMoveTx(tx); setSelectedBoardId('') }}>
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                          Mover para conta
                        </DropdownMenuItem>
                      )}
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

      {/* Move to board dialog */}
      <Dialog open={!!moveTx} onOpenChange={() => setMoveTx(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover para outra conta</DialogTitle>
            <DialogDescription>
              Selecione a conta de destino para &ldquo;{moveTx?.description}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 block">
              Conta de destino
            </Label>
            <Select value={selectedBoardId} onValueChange={(v) => v && setSelectedBoardId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta..." />
              </SelectTrigger>
              <SelectContent>
                {otherBoards.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveTx(null)}>Cancelar</Button>
            <Button onClick={confirmMove} disabled={!selectedBoardId || moving}>
              {moving ? 'Movendo...' : 'Mover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
