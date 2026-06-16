'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, TransactionFilters } from '@/types'

export function useTransactions(filters?: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })

    if (filters?.month && filters?.year) {
      const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
      const end = new Date(filters.year, filters.month, 0).toISOString().split('T')[0]
      query = query.gte('date', start).lte('date', end)
    } else if (filters?.year) {
      query = query
        .gte('date', `${filters.year}-01-01`)
        .lte('date', `${filters.year}-12-31`)
    }

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    if (filters?.search) {
      query = query.ilike('description', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setTransactions(data as Transaction[])
    }
    setLoading(false)
  }, [filters?.month, filters?.year, filters?.category, filters?.search])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  async function createTransaction(tx: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }

    const { error } = await supabase.from('transactions').insert({
      ...tx,
      user_id: user.id,
    })

    if (!error) fetchTransactions()
    return { error }
  }

  async function updateTransaction(id: string, tx: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at'>>) {
    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .update(tx)
      .eq('id', id)

    if (!error) fetchTransactions()
    return { error }
  }

  async function deleteTransaction(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (!error) fetchTransactions()
    return { error }
  }

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  }
}
