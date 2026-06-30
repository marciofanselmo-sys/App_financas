'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, TransactionType } from '@/types'

export interface RecurringItem {
  description: string
  category: string
  type: TransactionType
  avgAmount: number
  monthsCount: number
  lastDate: string
  board_id?: string | null
  group_label?: string | null
  is_recurring?: boolean
}

export interface InstallmentItem {
  description: string
  category: string
  monthlyAmount: number
  currentInstallment: number
  totalInstallments: number
  remaining: number
  endYearMonth: string   // "YYYY-MM"
  board_id?: string | null
}

function extractInstallment(t: Transaction): { base: string; current: number; total: number } | null {
  // New format: DB columns
  if (t.installment_total && t.installment_total > 1) {
    return { base: t.description, current: t.installment_current ?? 1, total: t.installment_total }
  }
  // Legacy format: "(X/Y)" appended to description by old parser
  const match = t.description.match(/^(.+?)\s*\((\d+)\/(\d+)\)$/)
  if (match && parseInt(match[3]) > 1) {
    return { base: match[1].trim(), current: parseInt(match[2]), total: parseInt(match[3]) }
  }
  return null
}

export function useRecurring(excludeBoardIds?: string[], boardId?: string) {
  const [recurring, setRecurring] = useState<RecurringItem[]>([])
  const [installments, setInstallments] = useState<InstallmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const excludeKey = excludeBoardIds?.join(',') ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Last 12 months of transactions
    const since = new Date()
    since.setMonth(since.getMonth() - 12)
    const sinceStr = since.toISOString().split('T')[0]

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', sinceStr)
      .order('date', { ascending: false })

    if (boardId) {
      query = query.eq('board_id', boardId)
    } else if (excludeKey) {
      query = query.or(`board_id.is.null,board_id.not.in.(${excludeKey})`)
    }

    const { data } = await query

    if (!data) { setLoading(false); return }
    const txs = data as Transaction[]

    // ── Installments ──────────────────────────────────────────────
    const todayStr = new Date().toISOString().split('T')[0]
    const instMap = new Map<string, { base: string; current: number; total: number; tx: Transaction }>()

    for (const t of txs) {
      const info = extractInstallment(t)
      if (!info) continue
      if (t.date > todayStr) continue
      const key = `${info.base.toLowerCase()}|${info.total}`
      const existing = instMap.get(key)
      if (!existing || info.current > existing.current) {
        instMap.set(key, { ...info, tx: t })
      }
    }

    const installmentList: InstallmentItem[] = []
    for (const { base, current, total, tx } of instMap.values()) {
      const remaining = total - current
      const endDate = new Date(tx.date)
      endDate.setMonth(endDate.getMonth() + remaining)
      const endYearMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`

      installmentList.push({
        description: base,
        category: tx.category,
        monthlyAmount: tx.amount,
        currentInstallment: current,
        totalInstallments: total,
        remaining,
        endYearMonth,
        board_id: tx.board_id,
      })
    }

    // ── Recurring (non-installment) ───────────────────────────────
    const recurMap = new Map<string, {
      original: string
      category: string
      type: TransactionType
      amounts: number[]
      months: Set<string>
      lastDate: string
      board_id: string | null
      group_label: string | null
      is_recurring: boolean
    }>()

    for (const t of txs) {
      if (extractInstallment(t)) continue
      if (t.type !== 'despesa') continue

      const key = t.description.toLowerCase().trim()
      const month = t.date.substring(0, 7)

      if (!recurMap.has(key)) {
        recurMap.set(key, {
          original: t.description,
          category: t.category,
          type: t.type,
          amounts: [],
          months: new Set(),
          lastDate: t.date,
          board_id: t.board_id ?? null,
          group_label: t.group_label ?? null,
          is_recurring: t.is_recurring ?? false,
        })
      }
      const g = recurMap.get(key)!
      g.amounts.push(t.amount)
      g.months.add(month)
      if (t.is_recurring) g.is_recurring = true
      if (t.date > g.lastDate) {
        g.lastDate = t.date
        g.group_label = t.group_label ?? null
      }
    }

    const recurringList: RecurringItem[] = []
    for (const g of recurMap.values()) {
      if (g.months.size < 2 && !g.is_recurring) continue
      const avgAmount = g.amounts.reduce((a, b) => a + b, 0) / g.months.size
      recurringList.push({
        description: g.original,
        category: g.category,
        type: g.type,
        avgAmount,
        monthsCount: g.months.size,
        lastDate: g.lastDate,
        board_id: g.board_id,
        group_label: g.group_label,
        is_recurring: g.is_recurring,
      })
    }

    const currentYearMonth = new Date().toISOString().substring(0, 7)
    const visibleInstallments = installmentList.filter(item =>
      item.endYearMonth >= currentYearMonth
    )

    setInstallments(visibleInstallments.sort((a, b) => a.remaining - b.remaining))
    setRecurring(recurringList.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount))
    setLoading(false)
  }, [tick, excludeKey, boardId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function refetch() { setTick(t => t + 1) }

  return { recurring, installments, loading, refetch }
}
