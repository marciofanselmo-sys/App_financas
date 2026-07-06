// Prefixos que indicam transferência entre contas do próprio usuário (TED/DOC/transferência),
// não uma compra ou pagamento a terceiros. PIX é propositalmente EXCLUÍDO daqui — a maioria dos
// PIX é pagamento a lojas/pessoas (uma despesa ou receita real), não uma movimentação interna.
const TRANSFER_PATTERNS = [
  /^transfer[êe]ncia\b/i,
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
