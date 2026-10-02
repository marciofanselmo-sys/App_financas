import { Transaction, TransactionBoard } from '@/types'
import { MonthBucket } from '@/lib/dashboard-charts'

/** Aportes em contas de investimento (regra 7.18). */
export function sumInvestmentContributions(
  transactions: Transaction[],
  boards: TransactionBoard[],
): number {
  const investmentIds = new Set(boards.filter(b => b.is_investment).map(b => b.id))
  const investmentNames = boards
    .filter(b => b.is_investment)
    .map(b => b.name.toLowerCase().trim())
    .filter(n => n.length >= 2)

  const matches = transactions.filter(t => {
    // Aporte é dinheiro CHEGANDO na conta de investimento, ou saindo de outra
    // conta em direção a ela. Resgate (o contrário) não conta.
    if (t.board_id && investmentIds.has(t.board_id)) return t.type === 'receita'
    // Saída ligada a uma conta de investimento pela regra "Entre minhas
    // contas" (ex.: "ENVIO DE TED TRANSF" do C6 → RICO). É o critério certo;
    // o do nome no texto abaixo fica para quem ainda não configurou.
    if (t.type === 'despesa' && t.counterpart_board_id && investmentIds.has(t.counterpart_board_id)) return true
    const desc = t.description.toLowerCase()
    return t.type === 'despesa' && investmentNames.some(name => desc.includes(name))
  })

  const seen = new Set<string>()
  let total = 0
  for (const t of matches) {
    // A chave inclui a conta: dois aportes de R$ 500 no mesmo dia, em
    // corretoras diferentes, tinham a mesma chave e um deles era descartado
    // como se fosse a outra perna do mesmo movimento. (14.18)
    const key = `${t.date}|${Number(t.amount)}|${t.board_id ?? 'sem-conta'}`
    if (seen.has(key)) continue
    seen.add(key)
    total += Number(t.amount)
  }
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
