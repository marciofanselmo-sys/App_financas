'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { TransactionBoard, BoardIconKey, BoardType } from '@/types'
import { createClient } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(row: any): TransactionBoard {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon as BoardIconKey,
    description: row.description ?? undefined,
    type: (row.type ?? 'ambos') as BoardType,
    is_investment: row.is_investment ?? false,
    show_on_dashboard: row.show_on_dashboard,
    last_position_import: row.last_position_import ?? undefined,
    created_at: row.created_at,
  }
}

// Store compartilhado entre TODAS as instâncias do hook (sidebar, lista de
// contas, tela de detalhe de conta, etc.) — sem isso, cada componente tinha
// sua própria cópia isolada de `boards`, então criar/editar/excluir uma
// conta numa tela não refletia em outra (ex: sidebar continuava mostrando a
// lista antiga até a página inteira recarregar).
let boardsCache: TransactionBoard[] = []
let loadingCache = true
let fetchedOnce = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getBoardsSnapshot() { return boardsCache }
function getLoadingSnapshot() { return loadingCache }

async function fetchBoards() {
  loadingCache = true
  notify()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loadingCache = false; notify(); return }

  const { data } = await supabase
    .from('transaction_boards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  boardsCache = (data ?? []).map(fromRow)
  loadingCache = false
  notify()
}

export function useTransactionBoards() {
  const boards = useSyncExternalStore(subscribe, getBoardsSnapshot, getBoardsSnapshot)
  const loading = useSyncExternalStore(subscribe, getLoadingSnapshot, getLoadingSnapshot)

  useEffect(() => {
    if (!fetchedOnce) {
      fetchedOnce = true
      fetchBoards()
    }
  }, [])

  async function createBoard(board: Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>): Promise<TransactionBoard | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Let the DB generate the UUID — don't generate client-side (avoids invalid uuid type errors)
    const { data, error } = await supabase
      .from('transaction_boards')
      .insert({
        user_id: user.id,
        name: board.name,
        color: board.color,
        icon: board.icon,
        description: board.description ?? null,
        type: board.type,
        is_investment: board.is_investment,
        show_on_dashboard: board.show_on_dashboard,
      })
      .select()
      .single()

    if (!error && data) {
      const created = fromRow(data)
      boardsCache = [...boardsCache, created]
      notify()
      return created
    }
    return null
  }

  async function updateBoard(id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { error } = await supabase.from('transaction_boards').update(data).eq('id', id)
    if (!error) {
      boardsCache = boardsCache.map(b => b.id === id ? { ...b, ...data } : b)
      notify()
    }
  }

  // Exclusão total: apaga todas as transações vinculadas à conta antes de
  // apagar a conta em si. Diferente do padrão antigo (a FK de transactions.board_id
  // é "on delete set null", que só desvincularia) — aqui é apagar de verdade,
  // por pedido explícito do usuário.
  async function deleteBoard(id: string): Promise<{ error: string | null }> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('board_id', id)
    if (txError) return { error: txError.message }

    const { error } = await supabase.from('transaction_boards').delete().eq('id', id)
    if (error) return { error: error.message }

    boardsCache = boardsCache.filter(b => b.id !== id)
    notify()
    return { error: null }
  }

  return { boards, loading, createBoard, updateBoard, deleteBoard, refetch: fetchBoards }
}
