import { TransactionType } from '@/types'

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
  // TED em qualquer posição, não só no início: extratos reais escrevem
  // "ENVIO DE TED TRANSF" (C6), não "TED ...". Com âncora no início, 10
  // aportes à corretora passavam batido e viravam gasto comum.
  /\bted\b/i,
  /^doc\b/i,
  // Pagamento de fatura de cartão: dinheiro saindo da conta corrente pra quitar
  // o próprio cartão — o gasto de verdade já foi contado item a item na fatura,
  // então isso é movimentação interna, não uma receita nem uma despesa nova.
  // "p\s?agamento" tolera um espaço espúrio que o pdf.js às vezes insere entre a
  // primeira letra e o resto da palavra (achado testando fatura real do Inter).
  /^p\s?agamento\s+de\s+fatura\b/i,
  /^pagto\s+de?\s*fatura\b/i,
  /^p\s?agamento\s+fatura\b/i,
  // "PGTO FAT CARTAO C6" — abreviação que o C6 usa na conta corrente. Sem
  // esta linha, 59 pagamentos de fatura entravam como despesa comum e
  // inflavam "Despesas do mês" em dezenas de milhares de reais.
  /^pgto\s+fat/i,
]

export function isTransferDescription(raw: string): boolean {
  const s = raw.trim()
  return TRANSFER_PATTERNS.some(p => p.test(s))
}

/**
 * Classifica uma linha de extrato, marcando movimentação interna.
 *
 * `naturalType` é o que o sinal do extrato (ou as colunas Entrada/Saída) já
 * diz: dinheiro entrando é receita, saindo é despesa. Esse tipo é SEMPRE
 * preservado — é ele que faz o saldo da conta se mexer corretamente.
 *
 * O que a detecção acrescenta é só `is_internal`: "esta despesa não é um
 * gasto seu, é dinheiro seu mudando de lugar". Até set/2026 essas linhas
 * viravam type='transferencia', o que descartava a direção e as tornava
 * invisíveis no saldo (14.1 / 14.2) — e, pior, 60% delas eram Pix a
 * terceiros classificados errado, que sumiam de "Despesas do mês".
 */
export function classifyTransaction(
  description: string,
  naturalType: 'receita' | 'despesa',
  ownerName?: string | null,
): { type: TransactionType; is_internal: boolean } {
  return {
    type: naturalType,
    is_internal: isTransferDescription(description) || mentionsOwner(description, ownerName),
  }
}

function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A descrição cita o próprio titular da conta?
 *
 * "Pix recebido de MARCIO FAGUNDES ANSELMO" é o usuário mandando dinheiro de
 * uma conta sua para outra — interna, por definição. Nenhum padrão de texto
 * pega isso: o rótulo do banco é idêntico ao de um Pix para terceiro, e a
 * única coisa que diferencia é o nome ser o dele.
 *
 * Exige nome completo (2+ palavras) e casa o nome inteiro, não pedaços: um
 * usuário chamado "Ana Silva" não pode marcar como interna toda transferência
 * para qualquer outra Silva. Nomes de uma palavra só são ignorados de
 * propósito — "Marcio" sozinho casaria com metade dos Pix do Brasil.
 */
export function mentionsOwner(description: string, ownerName?: string | null): boolean {
  if (!ownerName) return false
  const owner = normalizeName(ownerName)
  if (owner.split(' ').length < 2) return false
  return normalizeName(description).includes(owner)
}
