import type { BoardPositionImport, TransactionBoard } from '@/types'

/**
 * Cotações automáticas das contas de investimento.
 *
 * Ações, FIIs e ETFs da B3 (BBAS3, XPML11, IVVB11…) e criptomoedas (BTC,
 * ETH…) andam sozinhos: valor = quantidade da posição × preço de hoje. Renda
 * fixa, Tesouro e saldo parado não têm cotação e ficam no valor do extrato.
 *
 * A regra de valor da conta não muda (extrato OU soma dos aportes, nunca os
 * dois): a cotação só ATUALIZA o extrato — valor de hoje = valor do extrato +
 * o quanto os ativos cotados subiram ou caíram desde ele.
 */

export interface Quote {
  price: number
  /** ISO — quando a fonte publicou esse preço. */
  at: string
}
export type QuoteMap = Record<string, Quote>

/** Ticker da B3: 4 letras + 1–2 dígitos (+ letra opcional, ex.: units "11B"). */
export const isB3Ticker = (t: string) => /^[A-Z]{4}\d{1,2}[A-Z]?$/.test(t.trim().toUpperCase())

/** Criptos reconhecidas → id na CoinGecko. */
export const CRYPTO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin', XRP: 'ripple',
  ADA: 'cardano', DOGE: 'dogecoin', USDT: 'tether', USDC: 'usd-coin', MATIC: 'matic-network',
  DOT: 'polkadot', LTC: 'litecoin', AVAX: 'avalanche-2', LINK: 'chainlink', TRX: 'tron',
}
export const isCryptoTicker = (t: string) => t.trim().toUpperCase() in CRYPTO_IDS

export interface Holding {
  symbol: string
  kind: 'b3' | 'crypto'
  quantity: number
  /** Preço por unidade na data do extrato. */
  priceAtImport: number
  /** Valor desse ativo no extrato. */
  valueAtImport: number
  name?: string
}

function toNumber(s: string | number | undefined): number {
  if (typeof s === 'number') return s
  if (!s) return NaN
  const t = String(s).trim()
  // "1.234,56" (BR) ou "0.015" (ponto decimal)
  return t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
}

/** Ativos com cotação dentro do último extrato da conta. */
export function holdingsOf(pos: BoardPositionImport | undefined | null): Holding[] {
  if (!pos?.positions?.length) return []
  const out: Holding[] = []
  for (const p of pos.positions) {
    const symbol = p.ticker.trim().toUpperCase()
    const kind = isB3Ticker(symbol) ? 'b3' : isCryptoTicker(symbol) ? 'crypto' : null
    if (!kind) continue
    const value = Number(p.value) || 0
    let quantity = toNumber(p.quantity)
    // FII na planilha da Rico vem sem quantidade, mas com valor e última cotação.
    if (!(quantity > 0) && p.lastPrice && p.lastPrice > 0) quantity = Math.round(value / p.lastPrice)
    if (!(quantity > 0)) continue
    const priceAtImport = p.lastPrice && p.lastPrice > 0 ? p.lastPrice : value / quantity
    out.push({ symbol, kind, quantity, priceAtImport, valueAtImport: value || quantity * priceAtImport })
  }
  return out
}

export function holdingsOfBoard(board: TransactionBoard): Holding[] {
  return holdingsOf(board.last_position_import)
}

export interface LiveValue {
  /** Valor de hoje: extrato + variação dos ativos cotados. */
  value: number
  /** Quanto os ativos cotados variaram desde o extrato. */
  delta: number
  /** Mais recente entre as cotações usadas (ISO), ou null se nenhuma. */
  at: string | null
  quoted: number
}

/** Valor do extrato atualizado pelos preços de hoje (só o que tem cotação). */
export function liveValueOf(pos: BoardPositionImport | undefined | null, quotes: QuoteMap | null | undefined): LiveValue | null {
  if (!pos || !quotes) return null
  const hs = holdingsOf(pos)
  let delta = 0, quoted = 0
  let at: string | null = null
  for (const h of hs) {
    const q = quotes[h.symbol]
    if (!q || !(q.price > 0)) continue
    delta += h.quantity * q.price - h.valueAtImport
    quoted++
    if (!at || q.at > at) at = q.at
  }
  if (quoted === 0) return null
  return { value: pos.patrimonio + delta, delta, at, quoted }
}

/** Todos os símbolos cotáveis das contas, separados por fonte. */
export function symbolsOf(boards: TransactionBoard[]): { b3: string[]; crypto: string[] } {
  const b3 = new Set<string>(), crypto = new Set<string>()
  for (const b of boards) {
    for (const h of holdingsOfBoard(b)) (h.kind === 'b3' ? b3 : crypto).add(h.symbol)
  }
  return { b3: [...b3].sort(), crypto: [...crypto].sort() }
}

/**
 * Série diária do total das contas para o gráfico: em cada dia, o valor
 * "parado" das contas (extrato ou aportes, como hoje) + quanto os ativos
 * cotados valiam naquele dia a mais/menos do que no extrato. Usa a quantidade
 * de HOJE em todos os dias — mostra como o preço mexeu na carteira atual.
 * Dia sem pregão (fim de semana) repete o último fechamento.
 */
export function dailySeries(
  boards: TransactionBoard[],
  baseTotal: number,
  history: Record<string, [string, number][]>,
  quotes: QuoteMap,
): { date: string; value: number }[] {
  const holdings = boards.flatMap(holdingsOfBoard).filter(h => (history[h.symbol]?.length ?? 0) > 0)
  if (holdings.length === 0) return []
  const today = new Date().toLocaleDateString('en-CA')
  const dates = [...new Set(holdings.flatMap(h => history[h.symbol].map(p => p[0])))].sort()
  if (dates.at(-1) !== today && holdings.some(h => quotes[h.symbol])) dates.push(today)
  const closeOn = (h: Holding, d: string) => {
    if (d === today && quotes[h.symbol]) return quotes[h.symbol].price
    const pts = history[h.symbol]
    let price = pts[0][1]
    for (const [day, p] of pts) { if (day > d) break; price = p }
    return price
  }
  return dates.map(date => ({
    date,
    value: baseTotal + holdings.reduce((s, h) => s + h.quantity * closeOn(h, date) - h.valueAtImport, 0),
  }))
}
