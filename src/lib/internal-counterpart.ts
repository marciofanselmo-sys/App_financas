import { TransactionBoard } from '@/types'

// Palavras que aparecem no nome de quase toda conta e não identificam
// nenhuma: usá-las para casar faria "Banco Inter - Crédito" bater com
// "PGTO FAT CARTAO C6" só porque as duas falam de crédito.
const GENERIC_TOKENS = new Set([
  'banco', 'bank', 'conta', 'cartao', 'cartão', 'credito', 'crédito',
  'debito', 'débito', 'principal', 'corrente', 'poupanca', 'poupança',
  'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'minha', 'meu',
])

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Tokens que realmente identificam a conta (ex: "c6", "inter", "mercado"). */
export function distinctiveTokens(boardName: string): string[] {
  return normalize(boardName)
    .split(/[^a-z0-9]+/)
    .filter(tk => tk.length >= 2 && !GENERIC_TOKENS.has(tk))
}

/**
 * Descobre qual conta uma movimentação interna quitou, a partir da descrição.
 *
 * "PGTO FAT CARTAO C6" saindo da conta corrente do C6 aponta para o cartão
 * C6 — o nome da conta de destino está escrito na própria descrição, que é
 * como praticamente todo banco identifica o pagamento.
 *
 * A conta de origem é excluída de propósito: sem isso "C6 Bank - Conta
 * Principal" e "C6 Bank - Crédito" empatariam em toda linha do C6.
 *
 * Devolve null quando nenhuma conta casa OU quando mais de uma empata — o
 * empate é ambiguidade real (dois cartões do mesmo banco), e chutar o destino
 * moveria dinheiro para a conta errada. Nesses casos quem decide é o usuário.
 *
 * A exigência de TODOS os tokens é deliberadamente estrita: um nome como
 * "Itau Unibanco - CNPJ" não casa com "TED PARA ITAU UNIBANCO", e o app
 * pergunta em vez de adivinhar. A assimetria justifica — errar para menos
 * custa uma pergunta que vira regra; errar para mais credita a conta errada
 * e o usuário só descobre pelo saldo estranho semanas depois.
 */
export function findCounterpartBoard(
  description: string,
  boards: TransactionBoard[],
  originBoardId?: string | null,
): TransactionBoard | null {
  const desc = normalize(description)

  const scored = boards
    .filter(b => b.id !== originBoardId)
    .map(b => {
      const tokens = distinctiveTokens(b.name)
      if (tokens.length === 0) return { board: b, score: 0 }
      const hits = tokens.filter(tk => desc.includes(tk))
      // Exige todos os tokens distintivos: "Mercado Pago" não pode casar com
      // uma descrição que só diz "mercado".
      const score = hits.length === tokens.length ? tokens.join('').length : 0
      return { board: b, score }
    })
    .filter(s => s.score > 0)
    .sort((x, y) => y.score - x.score)

  if (scored.length === 0) return null
  // Empate no nome mais específico = ambiguidade real.
  if (scored.length > 1 && scored[0].score === scored[1].score) return null
  return scored[0].board
}

/** Dias de tolerância entre o pagamento sair e aparecer no extrato do destino. */
const PAIRING_TOLERANCE_DAYS = 3

function daysApart(a: string, b: string): number {
  const ms = Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime())
  return ms / 86_400_000
}

export interface ExistingLeg {
  board_id?: string | null
  amount: number
  date: string
  is_internal?: boolean
}

/**
 * A perna já existe no destino?
 *
 * Alguns bancos (Inter) listam o pagamento recebido no extrato do cartão;
 * outros (C6) não. Gerar a perna sem checar creditaria o cartão duas vezes
 * justamente nos bancos que se comportam bem.
 */
export function hasExistingLeg(
  existing: ExistingLeg[],
  boardId: string,
  amount: number,
  date: string,
): boolean {
  // Comparação em centavos inteiros: `Math.abs(a - b) < 0.01` parece exigir
  // valor igual, mas em ponto flutuante 671.98 vs 671.99 dá 0.00999... e
  // passava — um centavo de diferença pareava indevidamente.
  const cents = Math.round(amount * 100)
  return existing.some(e =>
    e.is_internal &&
    e.board_id === boardId &&
    Math.round(Number(e.amount) * 100) === cents &&
    daysApart(e.date, date) <= PAIRING_TOLERANCE_DAYS,
  )
}

export interface PaymentRow {
  id: string
  description: string
  amount: number
  date: string
  type: 'receita' | 'despesa' | 'transferencia'
  category: string
  counterpartBoardId: string
}

/**
 * A linha que credita a conta de destino.
 *
 * Espelho exato do pagamento: o que saiu da conta corrente entra no cartão.
 * Fica marcada como interna (não é renda) e guarda `counterpart_of_id`, que
 * impede a reimportação do mesmo extrato de creditar de novo.
 */
export function buildCounterpartLeg(
  payment: PaymentRow,
  userId: string,
  newId: string,
): Record<string, unknown> {
  return {
    id: newId,
    user_id: userId,
    description: payment.description,
    amount: payment.amount,
    date: payment.date,
    type: payment.type === 'receita' ? 'despesa' : 'receita',
    is_internal: true,
    category: payment.category,
    board_id: payment.counterpartBoardId,
    counterpart_of_id: payment.id,
    tags: [],
  }
}
