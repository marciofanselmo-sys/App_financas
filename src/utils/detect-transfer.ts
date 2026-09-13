import { TransactionType, TransferDirection } from '@/types'

// Prefixos que indicam transferência entre contas do próprio usuário (TED/DOC/transferência),
// não uma compra ou pagamento a terceiros. PIX é propositalmente EXCLUÍDO daqui — a maioria dos
// PIX é pagamento a lojas/pessoas (uma despesa ou receita real), não uma movimentação interna.
const TRANSFER_PATTERNS = [
  // Negative lookahead exclui variações de "Transferência ... Pix ..." — tanto
  // "Transferência Pix recebida NOME" (rótulo que o Mercado Pago usava em 2025
  // pro Pix normal, mudou pra só "Pix recebido/enviado" em 2026) quanto
  // "Transferência recebida pelo Pix - NOME" (Nubank, conta corrente). Em
  // ambos os casos é um Pix de verdade (pagamento a terceiro), não uma
  // movimentação entre contas do próprio usuário — sem essa exceção, todo Pix
  // desses extratos virava "transferência" por engano. Janela de 30 caracteres
  // (em vez de exigir "pix" logo em seguida) cobre "recebida"/"enviada pelo"
  // entre "transferência" e "pix" sem deixar de casar transferências reais que
  // mencionem "pix" bem mais adiante por coincidência.
  /^transfer[êe]ncia\b(?!.{0,30}\bpix\b)/i,
  /^transf\b/i,
  /^ted\b/i,
  /^doc\b/i,
  // Pagamento de fatura de cartão: dinheiro saindo da conta corrente pra quitar
  // o próprio cartão — o gasto de verdade já foi contado item a item na fatura,
  // então isso é movimentação interna, não uma receita nem uma despesa nova.
  // "p\s?agamento" tolera um espaço espúrio que o pdf.js às vezes insere entre a
  // primeira letra e o resto da palavra (achado testando fatura real do Inter).
  /^p\s?agamento\s+de\s+fatura\b/i,
  /^pagto\s+de?\s*fatura\b/i,
  /^p\s?agamento\s+fatura\b/i,
]

export function isTransferDescription(raw: string): boolean {
  const s = raw.trim()
  return TRANSFER_PATTERNS.some(p => p.test(s))
}

/**
 * Classifica uma linha de extrato SEM perder a direção do dinheiro.
 *
 * Todo parser sabe, pelo sinal do valor (ou pelas colunas Entrada/Saída), se a
 * linha é dinheiro entrando ou saindo — é isso que vira `receita`/`despesa`.
 * Até set/2026 cada parser repetia o mesmo `isTransferDescription(x) ?
 * 'transferencia' : (sinal)`, e nesse `?` a direção era jogada fora: sobrava
 * um `amount` positivo e nada que dissesse para onde o dinheiro foi. Sem esse
 * dado o saldo da conta não tinha como mexer (bugs 14.1 e 14.2).
 *
 * `naturalType` é o que a linha seria se não fosse interna. Transferência
 * mantém essa direção: receita → entrada, despesa → saída.
 */
export function classifyTransaction(
  description: string,
  naturalType: 'receita' | 'despesa',
): { type: TransactionType; direction?: TransferDirection } {
  if (!isTransferDescription(description)) return { type: naturalType }
  return {
    type: 'transferencia',
    direction: naturalType === 'receita' ? 'entrada' : 'saida',
  }
}
