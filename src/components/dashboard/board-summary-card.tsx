import { useRouter } from 'next/navigation'
import { TransactionBoard, Transaction } from '@/types'
import { BoardIcon } from '@/components/transactions/board-icon'
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface BoardSummaryCardProps {
  board: TransactionBoard
  transactions: Transaction[]
}

export function BoardSummaryCard({ board, transactions }: BoardSummaryCardProps) {
  const router = useRouter()
  const income = transactions.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
  // transferencias are excluded from both totals
  const balance = income - expenses
  const positive = balance >= 0

  return (
    <button
      onClick={() => router.push(`/transactions/${board.id}`)}
      className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group"
    >
      <div className="h-1 w-full" style={{ backgroundColor: board.color }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: board.color + '20' }}>
              <BoardIcon icon={board.icon} className="h-4 w-4" style={{ color: board.color }} />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{board.name}</span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors shrink-0" />
        </div>

        <p className={`text-xl font-bold mb-3 ${positive ? 'text-slate-800 dark:text-slate-100' : 'text-red-500'}`}>
          {formatCurrency(balance)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">Entradas</p>
              <p className="text-xs font-medium text-green-600">{formatCurrency(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">Saídas</p>
              <p className="text-xs font-medium text-red-500">{formatCurrency(expenses)}</p>
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}
