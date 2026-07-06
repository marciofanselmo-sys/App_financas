// Soma (ou subtrai, com número negativo) meses a uma data "YYYY-MM-DD",
// preservando o dia do mês e ajustando pro último dia válido quando o mês de
// destino for mais curto (ex: 31/jan + 1 mês = 28 ou 29/fev).
export function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const totalMonths = (m - 1) + months
  const newYear = y + Math.floor(totalMonths / 12)
  const newMonth = ((totalMonths % 12) + 12) % 12 + 1
  const lastDay = new Date(newYear, newMonth, 0).getDate()
  const newDay = Math.min(d, lastDay)
  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`
}
