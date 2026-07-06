// Remove datas embutidas na descrição de uma transação (ex: "PIX TRANSF
// FULANO 30/06", "PIX QRS RECEITA FED30/06" — sem espaço antes da data).
// Datas soltas na descrição quebram tudo que depende de comparação exata de
// texto entre meses (agrupamento de recorrência, regras automáticas,
// herança de categoria por histórico) — a cada mês a data muda e a "mesma"
// transação passa a parecer uma descrição nova.
export function stripEmbeddedDate(raw: string): string {
  if (!raw) return raw
  const cleaned = raw
    .replace(/\s*\d{2}\/\d{2}(\/\d{2,4})?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || raw
}
