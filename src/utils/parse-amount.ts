// Parser de valor monetário tolerante a formato BR (ponto = milhar, vírgula =
// decimal, ex: "1.234,56") e formato internacional (vírgula = milhar, ponto =
// decimal, ex: "1,234.56"), além de valores já "limpos" tipo "1234.56".
export function parseAmountBR(raw: string): number {
  let s = raw.trim().replace(/[^\d.,-]/g, '')
  if (!s) return NaN

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    // Os dois aparecem — o último dos dois é o separador decimal de verdade.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    // Só vírgula — formato BR, é o separador decimal.
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Só ponto (ou nenhum separador): já está em formato parseável, não mexe.

  return parseFloat(s)
}
