'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Activity, MinusCircle, ChevronRight, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { DashboardSummary } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function calcHealthScore(income: number, expenses: number): number | null {
  if (income === 0 && expenses === 0) return null
  if (income === 0) return 10
  const savingRate = (income - expenses) / income
  return Math.max(0, Math.min(100, Math.round(50 + savingRate * 50)))
}

export function scoreConfig(score: number): { label: string; color: string; barColor: string } {
  if (score >= 80) return { label: 'Excelente',   color: 'text-emerald-500', barColor: 'bg-emerald-500' }
  if (score >= 60) return { label: 'Bom',         color: 'text-blue-500',    barColor: 'bg-blue-500'    }
  if (score >= 40) return { label: 'Atenção',     color: 'text-amber-500',   barColor: 'bg-amber-500'   }
  if (score >= 20) return { label: 'Preocupante', color: 'text-orange-500',  barColor: 'bg-orange-500'  }
  return { label: 'Crítico', color: 'text-red-500', barColor: 'bg-red-500' }
}

function buildHealthAnalysis(score: number, income: number, expenses: number) {
  const savingRate = income > 0 ? (income - expenses) / income : 0
  const savingPct  = Math.round(savingRate * 100)
  const balance    = income - expenses

  const positives: string[] = []
  const concerns: string[]  = []
  let recommendation = ''

  if (income > 0) positives.push('Você registrou receitas este mês')
  if (balance >= 0) positives.push('Suas despesas ficaram abaixo da receita')
  if (savingPct >= 30) positives.push(`Taxa de poupança de ${savingPct}% — acima do ideal`)
  if (savingPct >= 20 && savingPct < 30) positives.push(`Taxa de poupança de ${savingPct}% — dentro do recomendado`)

  if (savingPct < 10) concerns.push(`Taxa de poupança muito baixa (${savingPct}%) — abaixo de 10%`)
  else if (savingPct < 20) concerns.push(`Taxa de poupança de ${savingPct}% — abaixo dos 20% recomendados`)
  if (expenses > income) concerns.push('Despesas superam as receitas este mês')
  if (income === 0) concerns.push('Nenhuma receita registrada neste período')

  if (score >= 80) {
    recommendation = `Ótimo trabalho! Você está poupando ${savingPct}% da renda. Considere direcionar parte para investimentos de longo prazo.`
  } else if (score >= 60) {
    recommendation = `Você está no caminho certo com ${savingPct}% de poupança. Tente chegar a 20-30% para construir reservas mais rapidamente.`
  } else if (score >= 40) {
    recommendation = `Sua taxa de poupança de ${savingPct}% precisa melhorar. Tente cortar gastos variáveis e montar um planejamento mensal.`
  } else {
    recommendation = `Atenção: você está gastando ${Math.round((expenses / income) * 100)}% da sua renda. Revise seus gastos por categoria e identifique onde reduzir.`
  }

  return { savingPct, positives, concerns, recommendation }
}

function HealthDialog({ open, onClose, score, income, expenses }: {
  open: boolean
  onClose: () => void
  score: number
  income: number
  expenses: number
}) {
  const cfg = scoreConfig(score)
  const { savingPct, positives, concerns, recommendation } = buildHealthAnalysis(score, income, expenses)
  const balance = income - expenses

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saúde Financeira</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Score visual */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl">
            <div className={`text-4xl font-black tabular-nums ${cfg.color}`}>{score}</div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span className={`font-bold ${cfg.color}`}>{cfg.label}</span>
                <span>/ 100</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cfg.barColor}`} style={{ width: `${score}%` }} />
              </div>
            </div>
          </div>

          {/* Cálculo resumido */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Receitas</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(income)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Despesas</p>
              <p className="text-sm font-bold text-red-500 mt-1">{formatCurrency(expenses)}</p>
            </div>
            <div className={`rounded-xl p-3 ${balance >= 0 ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Poupança</p>
              <p className={`text-sm font-bold mt-1 ${balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                {savingPct}%
              </p>
            </div>
          </div>

          {/* Pontos positivos */}
          {positives.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Pontos positivos</p>
              <div className="space-y-1.5">
                {positives.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pontos de atenção */}
          {concerns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Pontos de atenção</p>
              <div className="space-y-1.5">
                {concerns.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendação */}
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Recomendação
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{recommendation}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const { totalIncome, totalExpenses, balance } = summary
  const score   = calcHealthScore(totalIncome, totalExpenses)
  const hasData = score !== null
  const cfg     = hasData ? scoreConfig(score!) : null
  const positive = balance >= 0
  const [healthOpen, setHealthOpen] = useState(false)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receitas</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Total do período</p>
        </div>

        {/* Despesas */}
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Despesas</span>
            <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-red-500 leading-none tabular-nums">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Total do período</p>
        </div>

        {/* Saldo */}
        <div className={`rounded-2xl p-5 shadow-md ${
          positive
            ? 'bg-blue-600 shadow-blue-600/20'
            : 'bg-red-500 shadow-red-500/20'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">Saldo</span>
            <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-white leading-none tabular-nums">
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-white/50 mt-2">Receitas − Despesas</p>
        </div>

        {/* Saúde Financeira — clicável */}
        <button
          onClick={() => hasData && setHealthOpen(true)}
          className={`bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06] text-left w-full ${hasData ? 'hover:shadow-md hover:border-purple-200 dark:hover:border-purple-500/30 transition-all cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saúde</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${hasData ? 'bg-purple-50 dark:bg-purple-500/10' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
              {hasData
                ? <Activity className="h-4 w-4 text-purple-500" />
                : <MinusCircle className="h-4 w-4 text-slate-400" />
              }
            </div>
          </div>

          {hasData && cfg ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <p className={`text-[1.6rem] font-bold leading-none tabular-nums ${cfg.color}`}>{score}</p>
                <span className="text-sm text-slate-400 dark:text-slate-500 font-normal">/100</span>
              </div>
              <div className="mt-3 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`} style={{ width: `${score!}%` }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                <span className="flex items-center gap-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  Detalhes <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 leading-snug mt-1">
                Indisponível
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-snug">
                Adicione movimentações para calcular sua pontuação.
              </p>
            </>
          )}
        </button>
      </div>

      {hasData && (
        <HealthDialog
          open={healthOpen}
          onClose={() => setHealthOpen(false)}
          score={score!}
          income={totalIncome}
          expenses={totalExpenses}
        />
      )}
    </>
  )
}
