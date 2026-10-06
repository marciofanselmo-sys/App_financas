import { Transaction, TransactionBoard } from '@/types'
import { MonthBucket } from '@/lib/dashboard-charts'

/** Aportes em contas de investimento (regra 7.18). */
export function sumInvestmentContributions(
  transactions: Transaction[],
  boards: TransactionBoard[],
): number {
  const investmentIds = new Set(boards.filter(b => b.is_investment).map(b => b.id))

  // Para cada lançamento, a conta de investimento que recebeu o dinheiro.
  const destinationOf = (t: Transaction): string | null => {
    // Aporte é dinheiro CHEGANDO na conta de investimento, ou saindo de outra
    // conta em direção a ela. Resgate (o contrário) não conta.
    if (t.board_id && investmentIds.has(t.board_id)) return t.type === 'receita' ? t.board_id : null
    if (t.type !== 'despesa') return null
    // Saída ligada a uma conta de investimento pela regra "Entre minhas
    // contas" (ex.: "ENVIO DE TED TRANSF" do C6 → RICO). É o critério certo;
    // o do nome no texto abaixo fica para quem ainda não configurou.
    if (t.counterpart_board_id && investmentIds.has(t.counterpart_board_id)) return t.counterpart_board_id
    const desc = t.description.toLowerCase()
    const byName = boards.find(b => b.is_investment && b.name.trim().length >= 2 && desc.includes(b.name.toLowerCase().trim()))
    return byName ? byName.id : null
  }

  // Um aporte aparece duas vezes: a saída na conta corrente e a entrada na
  // corretora (do extrato dela ou criada pelo app). Antes a chave usava a
  // conta de cada lado e o mesmo aporte somava em dobro. Agora a chave é a
  // conta de DESTINO — igual nos dois lados — e cada chave vale o maior número
  // entre saídas e entradas: o par conta uma vez, dois aportes iguais no mesmo
  // dia contam dois, e corretoras diferentes seguem separadas (14.18).
  const groups = new Map<string, { amount: number; out: number; in: number }>()
  for (const t of transactions) {
    const dest = destinationOf(t)
    if (!dest) continue
    const key = `${t.date}|${Number(t.amount)}|${dest}`
    const g = groups.get(key) ?? { amount: Number(t.amount), out: 0, in: 0 }
    if (t.type === 'receita') g.in++
    else g.out++
    groups.set(key, g)
  }
  let total = 0
  for (const g of groups.values()) total += g.amount * Math.max(g.out, g.in)
  return total
}

export interface ContributionMonthPoint {
  label: string
  key: string
  aportes: number
}

export function aggregateContributionsByMonth(
  transactions: Transaction[],
  boards: TransactionBoard[],
  range: MonthBucket[],
): ContributionMonthPoint[] {
  return range.map(({ key, label, month, year }) => {
    const monthTx = transactions.filter(t => {
      const d = new Date(`${t.date}T12:00:00`)
      return d.getMonth() + 1 === month && d.getFullYear() === year
    })
    return { key, label, aportes: sumInvestmentContributions(monthTx, boards) }
  })
}

/**
 * Total aportado numa conta de investimento: o ponto de partida (o que já
 * estava aplicado até invested_base_date) + as saídas das suas contas ligadas
 * a ela depois dessa data. Rendimento = valor atual − este total.
 */
export interface BoardContributions {
  base: number
  baseDate: string | null
  aportes: Transaction[]
  aportado: number
  /** Há base ou aporte ligado — sem isso, rendimento não tem como ser calculado. */
  configured: boolean
}

export function contributionsForBoard(
  board: TransactionBoard,
  linked: Pick<Transaction, 'id' | 'date' | 'amount' | 'type' | 'counterpart_board_id' | 'description' | 'board_id'>[],
): BoardContributions {
  const base = Number(board.invested_base ?? 0)
  const baseDate = board.invested_base_date ?? null
  const aportes = linked
    .filter(t => t.type === 'despesa' && t.counterpart_board_id === board.id && (!baseDate || t.date > baseDate))
    .sort((a, b) => b.date.localeCompare(a.date)) as Transaction[]
  const aportado = base + aportes.reduce((sum, t) => sum + Number(t.amount), 0)
  return { base, baseDate, aportes, aportado, configured: base > 0 || aportes.length > 0 }
}

// ── Valor de uma conta de investimento ──────────────────────────────────────

export type InvestmentValueSource = 'position' | 'manual' | 'aportes' | 'none'

export interface InvestmentValue {
  /** O valor da conta — o que ela mostra e o que soma no patrimônio e nas metas. */
  value: number
  source: InvestmentValueSource
  /** Data do extrato (planilha ou valor informado), se houver. */
  positionDate: string | null
  aportado: number
  /** Valor − aportado; só quando há extrato E aportes (sem extrato não há rendimento). */
  gain: number | null
}

/**
 * O valor de uma conta de investimento — regra do dono (01/10/2026):
 *  - tem extrato (planilha importada ou valor informado)? vale o extrato;
 *  - não tem? vale a soma dos aportes (+ ponto de partida);
 *  - nenhum dos dois: sem valor.
 * Nunca soma extrato com aportes. Patrimônio, total de Investimentos e metas
 * ligadas usam ESTE valor, o mesmo que a conta mostra.
 *
 * Só LÊ os aportes (contributionsForBoard); a regra de aportes não muda aqui.
 */
export function investmentValueOf(
  board: TransactionBoard,
  linked: Pick<Transaction, 'id' | 'date' | 'amount' | 'type' | 'counterpart_board_id' | 'description' | 'board_id'>[],
): InvestmentValue {
  const c = contributionsForBoard(board, linked)
  const pos = board.last_position_import
  if (pos) {
    return {
      value: pos.patrimonio,
      source: pos.source === 'manual' ? 'manual' : 'position',
      positionDate: pos.importedAt.slice(0, 10),
      aportado: c.aportado,
      gain: c.configured ? pos.patrimonio - c.aportado : null,
    }
  }
  if (c.configured) {
    return { value: c.aportado, source: 'aportes', positionDate: null, aportado: c.aportado, gain: null }
  }
  return { value: 0, source: 'none', positionDate: null, aportado: 0, gain: null }
}

/** Texto curto da origem do valor, para mostrar junto do número. */
export function investmentValueLabel(v: InvestmentValue): string {
  const d = v.positionDate ? new Date(`${v.positionDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : ''
  return v.source === 'position' ? `pelo extrato de ${d}`
    : v.source === 'manual' ? `pelo valor informado em ${d}`
      : v.source === 'aportes' ? 'pela soma dos aportes (sem extrato)'
        : 'sem valor'
}
