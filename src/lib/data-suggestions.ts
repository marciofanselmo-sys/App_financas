import { findPairedEntry } from '@/lib/internal-counterpart'

/**
 * Ajustes sugeridos: o app cruza os lançamentos e propõe correções que o usuário não
 * saberia procurar — a regra "Entre minhas contas" existe, mas fica escondida
 * em Regras automáticas.
 *
 * Só cálculo, nada grava aqui. Aplicar/desfazer mora na tela Ajustes sugeridos.
 */

export interface SuggestionTx {
  id: string
  description: string
  amount: number
  date: string
  type: 'receita' | 'despesa'
  board_id: string | null
  is_internal?: boolean | null
  counterpart_board_id?: string | null
  counterpart_of_id?: string | null
  created_at?: string
}

export interface SuggestionRule {
  id: string
  keyword: string
  match_type: string
  action?: string
  scope_board_id?: string | null
  target_board_id?: string | null
}

export interface PairSuggestion {
  kind: 'internal-pair'
  key: string
  originBoardId: string
  targetBoardId: string
  /** Texto da saída, como vira a regra (maiúsculas). */
  keyword: string
  /** Regra "Entre minhas contas" com esse texto que já existe (será completada). */
  existingRule: SuggestionRule | null
  /** Saídas + a entrada do mesmo valor no destino, mais recentes primeiro. */
  pairs: { out: SuggestionTx; entry: SuggestionTx }[]
  /** Textos das entradas no destino (para o usuário reconhecer). */
  entryTexts: string[]
  /** Saídas com par que ainda somam como despesa (a regra vai tirar). */
  outflowsStillCounting: number
  entriesStillCounting: number
  /**
   * Saídas com o mesmo texto na origem SEM entrada correspondente no destino.
   * A regra sugerida usa require_pair: essas continuam somando.
   */
  unpairedOutflows: SuggestionTx[]
  /** Quanto ainda soma, no ano corrente, de cada lado. */
  year: number
  expenseThisYear: number
  incomeThisYear: number
  /** A saída já está fora das somas; só a entrada no destino ainda conta. */
  onlyEntryMissing: boolean
}

export type Suggestion = PairSuggestion

const isInternal = (t: SuggestionTx) => !!t.is_internal || !!t.counterpart_board_id || !!t.counterpart_of_id
const norm = (s: string) => s.trim().toUpperCase()

/** Pares abaixo disso podem ser coincidência de valor (compra × PIX de terceiro). */
const MIN_REPEATS = 2

/**
 * Parte mínima das saídas com aquele texto que precisa ter o par. Transferência
 * para a própria conta tem par quase sempre ("PIX TRANSF MARCIO": 19 de 19);
 * compra que coincide de valor com um PIX recebido, quase nunca ("MP
 * *ALIEXPRESS": 2 de 10 com 5 dias de tolerância).
 */
const MIN_PAIRED_SHARE = 0.5

/** Conta que é cartão de crédito — compra nele nunca é dinheiro indo para outra conta sua. */
export function isCreditCardBoard(b: { type?: string; icon?: string; name: string }): boolean {
  return b.type === 'saida' || b.icon === 'credit-card' || /cart[aã]o|cr[eé]dito/i.test(b.name)
}

/**
 * Dinheiro que só mudou de lugar entre duas contas do usuário e ainda soma:
 * uma saída numa conta e, em até 5 dias, uma entrada do MESMO valor noutra.
 *
 * Trava contra coincidência: o texto da saída precisa se repetir em pelo menos
 * MIN_REPEATS pares entre as mesmas duas contas. Nos dados reais que motivaram
 * isto, 7 "pares" eram compras no cartão × PIX recebidos de terceiros — cada
 * um com texto diferente, então nenhum vira sugestão.
 */
export function findPairSuggestions(
  txs: SuggestionTx[],
  rules: SuggestionRule[],
  now = new Date(),
  /** Contas que são cartão de crédito (ver isCreditCardBoard): nunca são origem. */
  cardBoardIds: Set<string> = new Set(),
): PairSuggestion[] {
  const year = now.getFullYear()
  const candidates = txs.filter(t => !t.counterpart_of_id && t.board_id)
  const entries = candidates.filter(t => t.type === 'receita')
  const allOutflows = candidates.filter(t => t.type === 'despesa')
  // Compra no cartão pode coincidir em valor com um PIX recebido, mas nunca é
  // dinheiro indo para outra conta sua.
  const outflows = allOutflows
    .filter(t => !cardBoardIds.has(t.board_id!))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Um pareamento por entrada: a mesma linha nunca serve para duas saídas.
  const used = new Set<string>()
  const groups = new Map<string, { origin: string; target: string; keyword: string; pairs: { out: SuggestionTx; entry: SuggestionTx }[] }>()
  for (const out of outflows) {
    const others = entries.filter(e => e.board_id !== out.board_id)
    // findPairedEntry filtra por conta; tentamos cada conta de destino possível.
    const boards = [...new Set(others.map(e => e.board_id!))]
    let best: SuggestionTx | null = null
    for (const b of boards) {
      const e = findPairedEntry(others, b, Number(out.amount), out.date, 'receita', used)
      if (e && (!best || Math.abs(+new Date(e.date) - +new Date(out.date)) < Math.abs(+new Date(best.date) - +new Date(out.date)))) best = e
    }
    if (!best) continue
    used.add(best.id)
    const keyword = norm(out.description)
    const key = `pair|${out.board_id}|${best.board_id}|${keyword}`
    const g = groups.get(key) ?? { origin: out.board_id!, target: best.board_id!, keyword, pairs: [] }
    g.pairs.push({ out, entry: best })
    groups.set(key, g)
  }

  const result: PairSuggestion[] = []
  for (const [key, g] of groups) {
    if (g.pairs.length < MIN_REPEATS) continue
    // O par tem que ser o padrão daquele texto, não a exceção.
    const withText = outflows.filter(t => t.board_id === g.origin && norm(t.description).includes(g.keyword))
    if (g.pairs.length / withText.length < MIN_PAIRED_SHARE) continue
    const pendingPairs = g.pairs.filter(p => !isInternal(p.out) || !isInternal(p.entry))
    if (pendingPairs.length === 0) continue

    // A regra sugerida exige o par (require_pair): só as saídas com entrada
    // do mesmo valor no destino saem das somas. As demais com o mesmo texto
    // são mostradas à parte, para o usuário ver o que NÃO vai mudar.
    const pairedOutIds = new Set(g.pairs.map(p => p.out.id))
    const unpaired = outflows.filter(t =>
      t.board_id === g.origin && !pairedOutIds.has(t.id) && !isInternal(t) && norm(t.description).includes(g.keyword))
    const inYear = (t: SuggestionTx) => t.date.startsWith(String(year))
    const outStill = g.pairs.map(p => p.out).filter(o => !isInternal(o))
    const entryStill = g.pairs.map(p => p.entry).filter(e => !isInternal(e))

    const existingRule = rules.find(r =>
      r.action === 'internal' && norm(r.keyword) === g.keyword && (!r.scope_board_id || r.scope_board_id === g.origin),
    ) ?? null

    result.push({
      kind: 'internal-pair',
      key,
      originBoardId: g.origin,
      targetBoardId: g.target,
      keyword: g.keyword,
      existingRule,
      pairs: [...g.pairs].sort((a, b) => b.out.date.localeCompare(a.out.date)),
      entryTexts: [...new Set(g.pairs.map(p => p.entry.description.trim()))].slice(0, 2),
      outflowsStillCounting: outStill.length,
      entriesStillCounting: entryStill.length,
      unpairedOutflows: unpaired.sort((a, b) => b.date.localeCompare(a.date)),
      year,
      expenseThisYear: outStill.filter(inYear).reduce((s, t) => s + Number(t.amount), 0),
      incomeThisYear: entryStill.filter(inYear).reduce((s, t) => s + Number(t.amount), 0),
      onlyEntryMissing: outStill.length === 0,
    })
  }
  // O que mais distorce os números primeiro.
  return result.sort((a, b) => (b.expenseThisYear + b.incomeThisYear) - (a.expenseThisYear + a.incomeThisYear))
}

// ── Créditos lançados depois do fato ────────────────────────────────────────

/**
 * Entre 29 e 30/09/2026, salvar uma regra "Entre minhas contas" com destino
 * aplicava no histórico E lançava a entrada no destino para pagamentos sem
 * par. Na fatura do C6, isso creditou o cartão por pagamentos de faturas
 * cujas compras nunca foram importadas — o saldo do cartão ficou positivo.
 *
 * Esses créditos têm uma assinatura: são pernas geradas (counterpart_of_id) e
 * foram criadas muito depois do próprio pagamento. A perna da importação nasce
 * junto com o pagamento; a do backfill de 13/09 é anterior às regras.
 */
export const RULES_RELEASE = '2026-09-29'
const LATE_GAP_MS = 60 * 60 * 1000

export interface LateCreditGroup {
  boardId: string
  credits: SuggestionTx[]
  total: number
}

export function findLateCredits(txs: (SuggestionTx & { created_at?: string })[]): LateCreditGroup[] {
  const byId = new Map(txs.map(t => [t.id, t]))
  const groups = new Map<string, LateCreditGroup>()
  for (const leg of txs) {
    if (!leg.counterpart_of_id || !leg.created_at || !leg.board_id) continue
    if (leg.created_at < RULES_RELEASE) continue
    const payment = byId.get(leg.counterpart_of_id)
    if (!payment?.created_at) continue
    if (+new Date(leg.created_at) - +new Date(payment.created_at) < LATE_GAP_MS) continue
    const g = groups.get(leg.board_id) ?? { boardId: leg.board_id, credits: [], total: 0 }
    g.credits.push(leg)
    g.total += (leg.type === 'receita' ? 1 : -1) * Number(leg.amount)
    groups.set(leg.board_id, g)
  }
  return [...groups.values()].map(g => ({ ...g, credits: g.credits.sort((a, b) => b.date.localeCompare(a.date)) }))
}
