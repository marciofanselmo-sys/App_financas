import { Lightbulb } from 'lucide-react'
import { Transaction } from '@/types'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface DiagnosticCardProps {
  transactions: Transaction[]
  month: number
  year: number
}

export function DiagnosticCard({ transactions, month, year }: DiagnosticCardProps) {
  const monthName = MONTHS_PT[month - 1]

  const income = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expenses

  const catMap: Record<string, number> = {}
  transactions.filter(t => t.type === 'despesa').forEach(t => {
    catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount)
  })
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const topCat = sorted[0]

  if (income === 0 && expenses === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Diagnóstico de {monthName}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma movimentação registrada em {monthName} de {year}. Importe um extrato ou adicione transações manualmente.
        </p>
      </div>
    )
  }

  const pct = income > 0 ? Math.round((expenses / income) * 100) : null

  let mainText = `Em ${monthName}, `
  if (income === 0) {
    mainText += `foram registradas despesas de ${fmt(expenses)} sem receitas no período.`
  } else if (balance >= 0) {
    mainText += `você gastou ${pct}% da renda e ficou com saldo positivo de ${fmt(balance)}.`
  } else {
    const over = Math.abs((pct ?? 0) - 100)
    mainText += `as despesas superaram as receitas em ${fmt(Math.abs(balance))} — ${over}% acima do que entrou.`
  }

  if (topCat) {
    mainText += ` O maior gasto foi em ${topCat[0]}, com ${fmt(topCat[1])}.`
  }

  let tip = ''
  if (balance < 0 && income > 0) {
    tip = `Reduzindo 20% dos gastos, o saldo poderia melhorar aproximadamente ${fmt(expenses * 0.2)}.`
  } else if (balance > 0 && income > 0 && pct !== null && pct < 75) {
    tip = `Você economizou ${fmt(balance)} este mês. Considere direcionar parte para uma meta ou investimento.`
  } else if (pct !== null && pct >= 75 && balance >= 0) {
    tip = `Atenção: ${pct}% da renda foi para despesas. Crie uma margem de segurança reduzindo gastos variáveis.`
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Diagnóstico de {monthName}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{mainText}</p>
      {tip && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 pl-3 border-l-2 border-amber-400">
          {tip}
        </p>
      )}
    </div>
  )
}
