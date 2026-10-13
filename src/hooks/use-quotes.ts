'use client'

import { useEffect, useState } from 'react'
import type { TransactionBoard } from '@/types'
import { QuoteMap, symbolsOf } from '@/lib/quotes'

export type QuoteRange = '5d' | '1mo' | '3mo' | '1y'
export type HistoryMap = Record<string, [string, number][]>

/**
 * Cotações de hoje dos ativos das contas de investimento (e, opcionalmente, o
 * histórico diário para o gráfico). Sem ativo cotável, não chama nada.
 * Falhou: devolve vazio — as contas ficam no valor do extrato.
 */
export function useQuotes(boards: TransactionBoard[], range?: QuoteRange) {
  const { b3, crypto } = symbolsOf(boards)
  const symKey = `${b3.join(',')}|${crypto.join(',')}`
  const key = `${symKey}|${range ?? ''}`
  const [state, setState] = useState<{ key: string; quotes: QuoteMap; history: HistoryMap; fetchedAt: string | null }>({
    key: '', quotes: {}, history: {}, fetchedAt: null,
  })

  useEffect(() => {
    if (!b3.length && !crypto.length) return
    let cancelled = false
    const params = new URLSearchParams()
    if (b3.length) params.set('b3', b3.join(','))
    if (crypto.length) params.set('crypto', crypto.join(','))
    if (range) params.set('history', range)
    fetch(`/api/quotes?${params}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (cancelled || !json) return
        setState({ key, quotes: json.quotes ?? {}, history: json.history ?? {}, fetchedAt: json.fetchedAt ?? null })
      })
      .catch(() => { /* fica no valor do extrato */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const ready = state.key === key
  // Trocar só o período do gráfico não apaga os preços de hoje enquanto busca.
  const sameSymbols = state.key.startsWith(`${symKey}|`)
  return {
    quotes: sameSymbols ? state.quotes : {},
    history: ready ? state.history : {},
    fetchedAt: sameSymbols ? state.fetchedAt : null,
    loading: (b3.length > 0 || crypto.length > 0) && !ready,
  }
}
