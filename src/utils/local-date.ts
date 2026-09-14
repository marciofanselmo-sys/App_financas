/**
 * Datas no fuso local, nunca em UTC.
 *
 * `new Date().toISOString().split('T')[0]` parece devolver "hoje", mas converte
 * para UTC antes: das 21h do horário de Brasília em diante ele já devolve o dia
 * seguinte. Em um app financeiro isso faz uma parcela de amanhã contar como de
 * hoje, e uma transação lançada à noite cair no dia errado.
 *
 * Bug 14.17 da auditoria de set/2026.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Uma data qualquer como YYYY-MM-DD, no fuso de quem está olhando. */
export function toLocalISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Hoje como YYYY-MM-DD, no fuso de quem está olhando. */
export function todayISO(): string {
  return toLocalISO(new Date())
}

/** O mês corrente como YYYY-MM, no fuso de quem está olhando. */
export function currentYearMonth(): string {
  return todayISO().substring(0, 7)
}

/** `date` somada de `days` dias, preservando o fuso local. */
export function shiftDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return toLocalISO(d)
}

/** Hoje menos `months` meses, como YYYY-MM-DD no fuso local. */
export function monthsAgoISO(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return toLocalISO(d)
}
