import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CRYPTO_IDS, isB3Ticker, isCryptoTicker } from '@/lib/quotes'

/**
 * Cotações de hoje (e o histórico diário, para o gráfico) das ações/FIIs/ETFs
 * da B3 e das criptos que aparecem nas contas de investimento.
 *
 *   GET /api/quotes?b3=BBAS3,XPML11&crypto=BTC[&history=1mo|3mo|1y|5d]
 *
 * Fontes sem chave: Yahoo Finance (B3, sufixo .SA) e CoinGecko (cripto, BRL).
 * Cada consulta fica em cache no servidor (30 min o preço, 6 h o histórico),
 * compartilhado por todos os usuários — é isso que mantém o número de
 * chamadas baixo. Falha de uma fonte não derruba a resposta: o ativo só vem
 * sem preço, e a tela mantém o último valor do extrato.
 */
export const runtime = 'nodejs'

const QUOTE_TTL = 1800
const HISTORY_TTL = 6 * 3600
const RANGES: Record<string, { yahoo: string; days: number }> = {
  '5d': { yahoo: '5d', days: 7 },
  '1mo': { yahoo: '1mo', days: 31 },
  '3mo': { yahoo: '3mo', days: 92 },
  '1y': { yahoo: '1y', days: 366 },
}
const MAX_SYMBOLS = 40

type Point = [string, number] // [YYYY-MM-DD, preço de fechamento]

async function yahoo(symbol: string, range: string, revalidate: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.SA?range=${range}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate } })
  if (!res.ok) return null
  const json = await res.json()
  const r = json?.chart?.result?.[0]
  if (!r) return null
  const ts: number[] = r.timestamp ?? []
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const points: Point[] = []
  ts.forEach((t, i) => {
    const c = closes[i]
    if (typeof c === 'number' && c > 0) points.push([new Date(t * 1000).toISOString().slice(0, 10), c])
  })
  const price = Number(r.meta?.regularMarketPrice)
  const at = r.meta?.regularMarketTime ? new Date(r.meta.regularMarketTime * 1000).toISOString() : new Date().toISOString()
  return { price: price > 0 ? price : points.at(-1)?.[1] ?? 0, at, points }
}

async function coingeckoPrices(ids: string[]) {
  if (ids.length === 0) return {}
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=brl&include_last_updated_at=true`
  const res = await fetch(url, { next: { revalidate: QUOTE_TTL } })
  if (!res.ok) return {}
  return (await res.json()) as Record<string, { brl?: number; last_updated_at?: number }>
}

async function coingeckoHistory(id: string, days: number): Promise<Point[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=brl&days=${days}&interval=daily`
  const res = await fetch(url, { next: { revalidate: HISTORY_TTL } })
  if (!res.ok) return []
  const json = await res.json()
  const byDay = new Map<string, number>()
  for (const [t, p] of (json?.prices ?? []) as [number, number][]) byDay.set(new Date(t).toISOString().slice(0, 10), p)
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

export async function GET(req: NextRequest) {
  // Só para quem está logado: é dado público, mas a rota não é uma API aberta.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const list = (k: string) => (sp.get(k) ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const b3 = [...new Set(list('b3'))].filter(isB3Ticker).slice(0, MAX_SYMBOLS)
  const crypto = [...new Set(list('crypto'))].filter(isCryptoTicker).slice(0, MAX_SYMBOLS)
  const range = RANGES[sp.get('history') ?? ''] ?? null

  const quotes: Record<string, { price: number; at: string }> = {}
  const history: Record<string, Point[]> = {}

  await Promise.all(b3.map(async s => {
    try {
      const q = await yahoo(s, '5d', QUOTE_TTL)
      if (q && q.price > 0) quotes[s] = { price: q.price, at: q.at }
      if (range) {
        const h = await yahoo(s, range.yahoo, HISTORY_TTL)
        if (h) history[s] = h.points
      }
    } catch { /* ativo fica sem preço */ }
  }))

  try {
    const ids = crypto.map(c => CRYPTO_IDS[c])
    const prices = await coingeckoPrices(ids)
    for (const c of crypto) {
      const p = prices[CRYPTO_IDS[c]]
      if (p?.brl && p.brl > 0) {
        quotes[c] = { price: p.brl, at: p.last_updated_at ? new Date(p.last_updated_at * 1000).toISOString() : new Date().toISOString() }
      }
    }
    if (range) {
      await Promise.all(crypto.map(async c => {
        try { history[c] = await coingeckoHistory(CRYPTO_IDS[c], range.days) } catch { /* sem histórico */ }
      }))
    }
  } catch { /* cripto fica sem preço */ }

  return NextResponse.json(
    { quotes, history: range ? history : undefined, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
