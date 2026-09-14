'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addMonths } from '@/utils/add-months'
import { logSafeError } from '@/lib/supabase-error'
import { todayISO, currentYearMonth, monthsAgoISO } from '@/utils/local-date'
import { Transaction, TransactionType } from '@/types'

export interface RecurringItem {
  description: string
  descriptionVariants: string[]
  category: string
  type: TransactionType
  avgAmount: number
  monthsCount: number
  months: string[]
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

    // Últimos 12 meses. Data em fuso local: toISOString() converte para UTC e,
    // à noite no Brasil, muda a janela em um dia (14.17).
    const sinceStr = monthsAgoISO(12)

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

    // Busca paginada: o Supabase corta em 1000 linhas por consulta. Como a
    // ordenação é por data decrescente, o corte silencioso derrubava justamente
    // os meses mais ANTIGOS da janela de 12 meses — e é a presença em 2+ meses
    // que define se algo é recorrente. Um gasto fixo antigo simplesmente sumia
    // da tela (14.5).
    const PAGE = 1000
    const txs: Transaction[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await query.range(from, from + PAGE - 1)
      if (error) {
        logSafeError('useRecurring.fetch', error)
        setLoading(false)
        return
      }
      if (!data?.length) break
      txs.push(...(data as Transaction[]))
      if (data.length < PAGE) break
    }
    if (!txs.length) { setLoading(false); return }

    // ── Installments ──────────────────────────────────────────────
    const todayStr = todayISO()
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
      // addMonths, não setMonth: `new Date('2026-01-31').setMonth(+1)` cai em
      // 03/mar, porque fevereiro não tem dia 31 e o JS transborda para o mês
      // seguinte. O fim do parcelamento saltava um mês inteiro. (14.16)
      const endYearMonth = addMonths(tx.date, remaining).substring(0, 7)

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
      variants: Set<string>
      category: string
      type: TransactionType
      // Total POR MÊS, não a lista solta de valores: duas cobranças da mesma
      // assinatura no mesmo mês (importação duplicada, ou cobrança extra)
      // somavam dois valores e dividiam por um mês só, dobrando a média (14.6).
      monthTotals: Map<string, number>
      lastDate: string
      board_id: string | null
      group_label: string | null
      is_recurring: boolean
    }>()

    for (const t of txs) {
      if (extractInstallment(t)) continue

      // A chave inclui o tipo — sem isso, uma despesa e uma transferência com a
      // mesma descrição (ex: "Investimento") virariam um único grupo errado
      // depois que passamos a detectar recorrência nos três tipos.
      const key = `${t.type}|${t.description.toLowerCase().trim()}`
      const month = t.date.substring(0, 7)

      if (!recurMap.has(key)) {
        recurMap.set(key, {
          original: t.description,
          variants: new Set(),
          category: t.category,
          type: t.type,
          monthTotals: new Map(),
          lastDate: t.date,
          board_id: t.board_id ?? null,
          group_label: t.group_label ?? null,
          is_recurring: t.is_recurring ?? false,
        })
      }
      const g = recurMap.get(key)!
      g.monthTotals.set(month, (g.monthTotals.get(month) ?? 0) + Number(t.amount))
      g.variants.add(t.description)
      if (t.is_recurring) g.is_recurring = true
      if (t.date > g.lastDate) {
        g.lastDate = t.date
        g.group_label = t.group_label ?? null
      }
    }

    const recurringList: RecurringItem[] = []
    for (const g of recurMap.values()) {
      if (g.monthTotals.size < 2 && !g.is_recurring) continue
      // MEDIANA dos totais mensais, não média.
      //
      // A média divide a soma de tudo pelo número de meses — e com um mês
      // atípico ela desanda: a Netflix importada duas vezes em janeiro
      // aparecia como R$ 74,53/mês em vez de R$ 55,90. Somar por mês antes de
      // dividir (a correção que parecia óbvia) não muda nada: sum(todos)/meses
      // já é sum(totais mensais)/meses, o mesmo número.
      //
      // A mediana ignora o mês fora da curva. E quando a cobrança dobrada é
      // real e acontece todo mês, todos os meses ficam iguais e ela acerta
      // igual — é só quando UM mês destoa que as duas divergem. (14.6)
      const monthly = [...g.monthTotals.values()].sort((a, b) => a - b)
      const mid = Math.floor(monthly.length / 2)
      const avgAmount = monthly.length % 2 === 0
        ? (monthly[mid - 1] + monthly[mid]) / 2
        : monthly[mid]
      recurringList.push({
        description: g.original,
        descriptionVariants: Array.from(g.variants),
        category: g.category,
        type: g.type,
        avgAmount,
        monthsCount: g.monthTotals.size,
        months: Array.from(g.monthTotals.keys()),
        lastDate: g.lastDate,
        board_id: g.board_id,
        group_label: g.group_label,
        is_recurring: g.is_recurring,
      })
    }

    const thisYearMonth = currentYearMonth()
    const visibleInstallments = installmentList.filter(item =>
      item.endYearMonth >= thisYearMonth
    )

    setInstallments(visibleInstallments.sort((a, b) => a.remaining - b.remaining))
    setRecurring(recurringList.sort((a, b) => b.monthsCount - a.monthsCount || b.avgAmount - a.avgAmount))
    setLoading(false)
  }, [tick, excludeKey, boardId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function refetch() { setTick(t => t + 1) }

  // Remove um parcelamento da detecção automática, sem apagar as transações:
  // limpa as colunas de parcela (formato novo) e o sufixo "(X/Y)" (formato legado).
  async function dismissInstallment(item: InstallmentItem): Promise<boolean> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    // Filtra por board_id também: a mesma loja parcelada no Nubank e no Inter
    // tem descrição idêntica, e descartar o parcelamento de uma conta apagava
    // o da outra junto. (14.19)
    let dismissQuery = supabase
      .from('transactions')
      .update({ installment_current: null, installment_total: null })
      .eq('user_id', user.id)
      .eq('description', item.description)
      .eq('installment_total', item.totalInstallments)
    if (item.board_id) dismissQuery = dismissQuery.eq('board_id', item.board_id)
    const { error: e1 } = await dismissQuery

    const { data: legacyRows, error: e2select } = await supabase
      .from('transactions')
      .select('id, description')
      .eq('user_id', user.id)
      .like('description', `${item.description}%(%/${item.totalInstallments})`)

    let e2 = e2select
    for (const row of legacyRows ?? []) {
      const stripped = row.description.replace(/\s*\(\d+\/\d+\)$/, '').trim()
      if (stripped !== item.description) continue
      const { error } = await supabase.from('transactions').update({ description: stripped }).eq('id', row.id)
      if (error) e2 = error
    }

    if (e1) console.error('[dismissInstallment] erro (formato novo):', e1.message)
    if (e2) console.error('[dismissInstallment] erro (formato legado):', e2.message)

    return !e1 && !e2
  }

  return { recurring, installments, loading, refetch, dismissInstallment }
}
