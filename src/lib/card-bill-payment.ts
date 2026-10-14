/**
 * Pagamento de fatura ANTERIOR ao que está no app.
 *
 * O extrato do cartão de agosto traz as compras de agosto e o pagamento da
 * fatura de julho. Se as compras de julho não estão no app (primeira
 * importação), esse pagamento abate uma dívida que não existe aqui: o cartão
 * parece dever menos do que deve e o mês não fecha. A importação deixa essa
 * linha de fora e explica o porquê — o usuário pode importar mesmo assim.
 *
 * Só o pagamento que não tem NENHUMA compra do cartão de ~25 dias antes dele
 * para trás, nem no app nem no próprio arquivo. Importando o ano inteiro,
 * só o pagamento de janeiro (fatura de dezembro) cai aqui; os de fevereiro a
 * dezembro pagam faturas cujas compras vieram no mesmo arquivo.
 */

const PAYMENT = /\b(pagamento|pgto|pagto|pag)\b|fatura/i
const NOT_PAYMENT = /estorno|cashback|reembolso|devolu/i
/** Uma compra precisa ter acontecido pelo menos isto antes do pagamento para ser da fatura que ele paga. */
export const BILL_GAP_DAYS = 25

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function isBillPayment(description: string): boolean {
  const d = norm(description)
  return PAYMENT.test(d) && !NOT_PAYMENT.test(d)
}

function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA')
}

/**
 * Índices das linhas do arquivo que são pagamento de uma fatura fora do app.
 * `earliestSpendInApp`: data da compra mais antiga deste cartão já no app.
 */
export function previousBillPayments(
  rows: { description: string; type: 'receita' | 'despesa'; date: string; valid: boolean }[],
  earliestSpendInApp: string | null,
): number[] {
  const fileSpends = rows.filter(r => r.valid && r.type === 'despesa' && r.date).map(r => r.date).sort()
  const earliest = [earliestSpendInApp, fileSpends[0]].filter(Boolean).sort()[0] as string | undefined
  const out: number[] = []
  rows.forEach((r, i) => {
    if (!r.valid || r.type !== 'receita' || !r.date || !isBillPayment(r.description)) return
    if (!earliest || earliest > minusDays(r.date, BILL_GAP_DAYS)) out.push(i)
  })
  return out
}
