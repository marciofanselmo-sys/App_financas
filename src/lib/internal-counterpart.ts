import { TransactionBoard } from '@/types'

// Palavras que aparecem no nome de quase toda conta e não identificam nenhuma:
// usá-las para casar faria "Banco Inter - Crédito" bater com "PGTO FAT CARTAO
// C6" só porque as duas falam de crédito.
const GENERIC_TOKENS = new Set([
  'banco', 'bank', 'conta', 'cartao', 'credito', 'debito', 'principal',
  'corrente', 'poupanca', 'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a',
  'minha', 'meu',
])

// A descrição precisa parecer um pagamento/movimentação para outra conta, não
// uma compra qualquer. Sem isto, "SEGURO INTER" lançado na conta corrente
// criaria um crédito no cartão do Inter — dinheiro aparecendo numa conta que
// nunca recebeu nada.
const PAYMENT_INTENT = /\b(pgto|pagto|pagamento|fatura|ted|doc|transf|transferencia|aporte|envio)\b/i

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function tokenize(s: string): string[] {
  return normalize(s).split(/[^a-z0-9]+/).filter(Boolean)
}

/** Tokens que realmente identificam a conta (ex: "c6", "inter", "mercado"). */
export function distinctiveTokens(boardName: string): string[] {
  return tokenize(boardName).filter(tk => tk.length >= 2 && !GENERIC_TOKENS.has(tk))
}

/**
 * Descobre qual conta do próprio usuário esta linha quitou.
 *
 * "PGTO FAT CARTAO C6" saindo da conta corrente do C6 aponta para o cartão C6
 * — o nome da conta de destino está escrito na própria descrição, que é como
 * praticamente todo banco identifica o pagamento. Com o destino conhecido, o
 * app credita o cartão sozinho, sem depender de o banco exportar essa linha no
 * arquivo da fatura (o Inter exporta, o C6 não).
 *
 * Três travas contra creditar a conta errada, que é o erro caro aqui:
 *
 * 1. Compara TOKENS INTEIROS, não pedaços. A versão anterior usava
 *    `includes()`, e "COMPRA INTERNET VIVO" casava com a conta "Banco Inter".
 * 2. Exige que a descrição pareça um pagamento (ver PAYMENT_INTENT).
 * 3. Exclui a conta de origem — sem isso "C6 Bank - Conta Principal" e
 *    "C6 Bank - Crédito" empatariam em toda linha do C6.
 *
 * Devolve null quando nada casa OU quando duas contas empatam. Errar para
 * menos custa um cartão que não foi creditado, visível e corrigível; errar
 * para mais move dinheiro para a conta errada e só aparece semanas depois.
 */
export function findCounterpartBoard(
  description: string,
  boards: TransactionBoard[],
  originBoardId: string | null | undefined,
  paymentType: 'receita' | 'despesa',
): TransactionBoard | null {
  // Só SAÍDAS geram perna. A descrição nomeia a conta que está sendo PAGA, não
  // a que paga: numa linha de entrada ("PGTO FAT CARTAO C6" vista no extrato do
  // próprio cartão) o nome não diz de onde o dinheiro veio, e inferir pela
  // marca debitaria a conta errada se a fatura do C6 tivesse sido paga pelo
  // Nubank. Nesse caso a perna correta chega sozinha quando o extrato da conta
  // de origem for importado.
  if (paymentType !== 'despesa') return null
  if (!PAYMENT_INTENT.test(normalize(description))) return null

  const descTokens = new Set(tokenize(description))

  const scored = boards
    .filter(b => b.id !== originBoardId)
    .map(b => {
      const tokens = distinctiveTokens(b.name)
      if (tokens.length === 0) return { board: b, score: 0 }
      // Exige todos os tokens distintivos: "Mercado Pago" não pode casar com
      // uma descrição que só diz "mercado".
      const all = tokens.every(tk => descTokens.has(tk))
      return { board: b, score: all ? tokens.join('').length : 0 }
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null
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
  type: 'receita' | 'despesa'
}

/**
 * A perna já existe no destino?
 *
 * Alguns bancos (Inter) listam o pagamento recebido no extrato do cartão;
 * outros (C6) não. Gerar sem checar creditaria o cartão duas vezes justamente
 * nos bancos que se comportam bem.
 */
export function hasExistingLeg(
  existing: ExistingLeg[],
  boardId: string,
  amount: number,
  date: string,
  legType: 'receita' | 'despesa',
): boolean {
  // Centavos inteiros: `Math.abs(a - b) < 0.01` parece exigir valor igual, mas
  // em ponto flutuante 671.98 vs 671.99 dá 0.00999... e passava.
  const cents = Math.round(amount * 100)
  return existing.some(e =>
    e.board_id === boardId &&
    e.type === legType &&
    Math.round(Number(e.amount) * 100) === cents &&
    daysApart(e.date, date) <= PAIRING_TOLERANCE_DAYS,
  )
}

export interface PaymentRow {
  id: string
  description: string
  amount: number
  date: string
  type: 'receita' | 'despesa'
  category: string
  counterpartBoardId: string
}

/** O tipo que a perna terá no destino: espelho do pagamento. */
export function legTypeFor(paymentType: 'receita' | 'despesa'): 'receita' | 'despesa' {
  return paymentType === 'receita' ? 'despesa' : 'receita'
}

/**
 * A linha que credita a conta de destino — espelho exato do pagamento: o que
 * saiu da conta corrente entra no cartão. Guarda `counterpart_of_id`, que
 * impede a reimportação do mesmo extrato de creditar de novo e faz a linha ser
 * apagada junto se o pagamento original for excluído.
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
    type: legTypeFor(payment.type),
    category: payment.category,
    board_id: payment.counterpartBoardId,
    counterpart_of_id: payment.id,
    tags: [],
  }
}
