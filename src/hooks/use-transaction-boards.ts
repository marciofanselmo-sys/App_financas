'use client'

import { useState, useEffect } from 'react'
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
    show_on_dashboard: row.show_on_dashboard,
    created_at: row.created_at,
  }
}

export function useTransactionBoards() {
  const [boards, setBoards] = useState<TransactionBoard[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchBoards() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('transaction_boards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    setBoards((data ?? []).map(fromRow))
    setLoading(false)
  }

  useEffect(() => { fetchBoards() }, [])

  async function createBoard(board: Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
        show_on_dashboard: board.show_on_dashboard,
      })
      .select()
      .single()

    if (!error && data) {
      setBoards(prev => [...prev, fromRow(data)])
    }
  }

  async function updateBoard(id: string, data: Partial<Omit<TransactionBoard, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { error } = await supabase.from('transaction_boards').update(data).eq('id', id)
    if (!error) setBoards(prev => prev.map(b => b.id === id ? { ...b, ...data } : b))
  }

  async function deleteBoard(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('transaction_boards').delete().eq('id', id)
    if (!error) setBoards(prev => prev.filter(b => b.id !== id))
  }

  return { boards, loading, createBoard, updateBoard, deleteBoard, refetch: fetchBoards }
}
