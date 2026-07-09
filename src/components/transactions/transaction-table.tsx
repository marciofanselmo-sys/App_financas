'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MoreVertical, Pencil, Trash2, ArrowRightLeft, RefreshCw, Tag, X as XIcon } from 'lucide-react'
import { Transaction, TransactionBoard, Category } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { categoriesForTransactions } from '@/lib/special-category-filter'
import { installmentLabel } from '@/utils/format-installment'

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
  categories?: Category[]
  onBulkCategoryChange?: (ids: string[], category: string) => Promise<void>
  onBulkMove?: (ids: string[], boardId: string) => Promise<void>
  onBulkDelete?: (ids: string[]) => Promise<void>
}

export function TransactionTable({
  transactions, onEdit, onDelete, onMove, onToggleRecurring, boards, currentBoardId,
  categories, onBulkCategoryChange, onBulkMove, onBulkDelete,
}: TransactionTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [moveTx, setMoveTx] = useState<Transaction | null>(null)
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [moving, setMoving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [applyingBulk, setApplyingBulk] = useState(false)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkMoveBoardId, setBulkMoveBoardId] = useState('')
  const [bulkMoving, setBulkMoving] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const otherBoards = (boards ?? []).filter(b => b.id !== currentBoardId)
  const selectionEnabled = !!onBulkCategoryChange
  const allSelected = transactions.length > 0 && selected.size === transactions.length
  const selectedTransactions = transactions.filter(t => selected.has(t.id))
  // Normais e especiais em seletores separados, gravando no mesmo estado
  // (bulkCategory) — escolher em um desmarca o outro, igual ao formulário de
  // transação. A especial só é opção se valer pra TODAS as selecionadas.
  const bulkCategoryOptions = categoriesForTransactions(categories ?? [], selectedTransactions)
  const bulkNormalOptions = bulkCategoryOptions.filter(c => !c.special_dates || c.special_dates.length === 0)
  const bulkSpecialOptions = bulkCategoryOptions.filter(c => (c.special_dates?.length ?? 0) > 0)
  const bulkIsSpecial = bulkSpecialOptions.some(c => c.name === bulkCategory)

  // Nunca deixa a seleção "grudada" entre filtros diferentes (mês, busca, conta) —
  // sem isso, uma seleção antiga podia ser aplicada por engano numa lista diferente
  // da que está na tela.
  useEffect(() => {
    setSelected(new Set())
  }, [transactions])

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(transactions.map(t => t.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyBulkCategory() {
    if (!onBulkCategoryChange || !bulkCategory || selected.size === 0) return
    setApplyingBulk(true)
    await onBulkCategoryChange(Array.from(selected), bulkCategory)
    setApplyingBulk(false)
    setBulkConfirmOpen(false)
    setSelected(new Set())
    setBulkCategory('')
  }

  async function applyBulkMove() {
    if (!onBulkMove || !bulkMoveBoardId || selected.size === 0) return
    setBulkMoving(true)
    await onBulkMove(Array.from(selected), bulkMoveBoardId)
    setBulkMoving(false)
    setBulkMoveOpen(false)
    setSelected(new Set())
    setBulkMoveBoardId('')
  }

  async function applyBulkDelete() {
    if (!onBulkDelete || selected.size === 0) return
    setBulkDeleting(true)
    await onBulkDelete(Array.from(selected))
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelected(new Set())
  }

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
      {/* Barra de ação em massa */}
      {selectionEnabled && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 mb-3">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selected.size} selecionada{selected.size !== 1 ? 's' : ''}
          </span>
          <Select value={bulkIsSpecial ? '' : bulkCategory} onValueChange={v => { if (v) setBulkCategory(v) }}>
            <SelectTrigger className="w-48 h-9 bg-white dark:bg-slate-800">
              <SelectValue placeholder="Mudar categoria para..." />
            </SelectTrigger>
            <SelectContent>
              {bulkNormalOptions.map(c => (
                <SelectItem key={c.id} value={c.name}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkIsSpecial ? bulkCategory : ''} onValueChange={v => { if (v) setBulkCategory(v) }}>
            <SelectTrigger className="w-48 h-9 bg-white dark:bg-slate-800">
              <SelectValue placeholder="Categoria isolada..." />
            </SelectTrigger>
            <SelectContent>
              {bulkSpecialOptions.length === 0 ? (
                <SelectItem value="__empty__" disabled>Nenhuma isolada válida pra seleção</SelectItem>
              ) : (
                bulkSpecialOptions.map(c => (
                  <SelectItem key={c.id} value={c.name}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setBulkConfirmOpen(true)} disabled={!bulkCategory || applyingBulk} className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Aplicar
          </Button>

          {onBulkMove && otherBoards.length > 0 && (
            <Button
              size="sm" variant="outline"
              onClick={() => { setBulkMoveBoardId(''); setBulkMoveOpen(true) }}
              className="gap-1.5 bg-white dark:bg-slate-800"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Mover para conta
            </Button>
          )}

          {onBulkDelete && (
            <Button
              size="sm" variant="outline"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-1.5 bg-white dark:bg-slate-800 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          )}

          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 flex items-center gap-1 ml-auto"
          >
            <XIcon className="h-3.5 w-3.5" /> Cancelar seleção
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-700/50">
              {selectionEnabled && (
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"
                    aria-label="Selecionar todas"
                  />
                </TableHead>
              )}
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell w-28">Categoria</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell w-36">Data</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell w-24">Parcelas</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell w-28">Recorrência</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-24">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right w-28">Valor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                {selectionEnabled && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600 cursor-pointer"
                      aria-label={`Selecionar ${tx.description}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate overflow-hidden">{tx.description}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tx.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell">
                  {format(new Date(tx.date + 'T00:00:00'), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell">
                  {installmentLabel(tx)}
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
              <SelectTrigger className="w-full">
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

      <Dialog open={bulkConfirmOpen} onOpenChange={v => { if (!v) setBulkConfirmOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mudar categoria em massa</DialogTitle>
            <DialogDescription>
              Isso vai mudar a categoria de <strong>{selected.size} transaç{selected.size !== 1 ? 'ões' : 'ão'}</strong> selecionada{selected.size !== 1 ? 's' : ''} para <strong>&ldquo;{bulkCategory}&rdquo;</strong>. Só as transações marcadas com checkbox agora serão alteradas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} disabled={applyingBulk}>
              Cancelar
            </Button>
            <Button onClick={applyBulkCategory} disabled={applyingBulk}>
              {applyingBulk ? 'Aplicando...' : `Mudar ${selected.size} transaç${selected.size !== 1 ? 'ões' : 'ão'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMoveOpen} onOpenChange={v => { if (!v) setBulkMoveOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover em massa</DialogTitle>
            <DialogDescription>
              Selecione a conta de destino para <strong>{selected.size} transaç{selected.size !== 1 ? 'ões' : 'ão'}</strong> selecionada{selected.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2 block">
              Conta de destino
            </Label>
            <Select value={bulkMoveBoardId} onValueChange={v => v && setBulkMoveBoardId(v)}>
              <SelectTrigger className="w-full">
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
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)} disabled={bulkMoving}>Cancelar</Button>
            <Button onClick={applyBulkMove} disabled={!bulkMoveBoardId || bulkMoving}>
              {bulkMoving ? 'Movendo...' : `Mover ${selected.size} transaç${selected.size !== 1 ? 'ões' : 'ão'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={v => { if (!v) setBulkDeleteOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir em massa</DialogTitle>
            <DialogDescription>
              Essa ação não pode ser desfeita. <strong>{selected.size} transaç{selected.size !== 1 ? 'ões' : 'ão'}</strong> selecionada{selected.size !== 1 ? 's' : ''} será{selected.size !== 1 ? 'ão' : ''} removida{selected.size !== 1 ? 's' : ''} permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={applyBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Excluindo...' : `Excluir ${selected.size} transaç${selected.size !== 1 ? 'ões' : 'ão'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
