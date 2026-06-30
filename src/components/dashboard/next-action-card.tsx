'use client'

import Link from 'next/link'
import { useGoals } from '@/hooks/use-goals'
import { useBudgetPlan } from '@/hooks/use-budget-plan'
import { CheckCircle, Circle, ArrowRight, Sparkles } from 'lucide-react'

interface Props {
  hasTransactions: boolean
  hasBoards: boolean
  pendingRecurring: number
  activeInstallments: number
}

interface Action {
  id: string
  label: string
  description: string
  href: string
  done: boolean
}

export function NextActionCard({ hasTransactions, hasBoards, pendingRecurring, activeInstallments }: Props) {
  const now = new Date()
  const { goals } = useGoals()
  const { plan } = useBudgetPlan(now.getMonth() + 1, now.getFullYear())

  const hasPlan = plan != null && (
    plan.expected_income > 0 ||
    plan.investment_target > 0 ||
    plan.reserve_target > 0 ||
    Object.values(plan.category_limits ?? {}).some(v => v > 0)
  )
  const hasGoals = goals.length > 0

  const actions: Action[] = [
    {
      id: 'board',
      label: 'Criar conta ou cartão',
      description: 'Organize suas movimentações por conta bancária ou cartão.',
      href: '/transactions',
      done: hasBoards,
    },
    {
      id: 'transaction',
      label: 'Adicionar primeira movimentação',
      description: 'Importe um extrato bancário ou adicione uma transação manualmente.',
      href: '/transactions',
      done: hasTransactions,
    },
    {
      id: 'goal',
      label: 'Criar uma meta financeira',
      description: 'Defina um objetivo — reserva de emergência, viagem, imóvel.',
      href: '/goals',
      done: hasGoals,
    },
    {
      id: 'plan',
      label: 'Montar planejamento mensal',
      description: 'Defina limites por categoria e acompanhe o orçamento em tempo real.',
      href: '/planning',
      done: hasPlan,
    },
    {
      id: 'recurring',
      label: 'Confirmar recorrências',
      description: 'Revise e confirme os gastos fixos detectados automaticamente.',
      href: '/fixos',
      done: pendingRecurring === 0 && activeInstallments > 0,
    },
  ]

  const done  = actions.filter(a => a.done).length
  const total = actions.length
  const allDone = done === total
  const next = actions.find(a => !a.done)

  if (allDone) return null

  const pct = Math.round((done / total) * 100)

  return (
    <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Primeiros passos</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{done} de {total} concluídos</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Actions list */}
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        {actions.map(action => (
          <Link
            key={action.id}
            href={action.done ? '#' : action.href}
            className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
              action.done
                ? 'cursor-default'
                : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] group'
            }`}
            onClick={action.done ? e => e.preventDefault() : undefined}
          >
            {action.done ? (
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                action.done
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'text-slate-700 dark:text-slate-200'
              }`}>
                {action.label}
              </p>
              {!action.done && (
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{action.description}</p>
              )}
            </div>
            {!action.done && (
              <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors shrink-0" />
            )}
          </Link>
        ))}
      </div>

      {/* Next action highlight */}
      {next && (
        <div className="px-5 py-3 bg-blue-50 dark:bg-blue-500/10 border-t border-blue-100 dark:border-blue-500/20">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            Próxima ação: <Link href={next.href} className="underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300">{next.label}</Link>
          </p>
        </div>
      )}
    </div>
  )
}
