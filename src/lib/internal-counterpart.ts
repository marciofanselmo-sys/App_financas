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
