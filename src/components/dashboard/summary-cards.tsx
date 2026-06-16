import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { DashboardSummary } from '@/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const { totalIncome, totalExpenses, balance } = summary

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">Receitas</CardTitle>
          <div className="p-2 bg-green-50 rounded-lg">
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">Total do período</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">Despesas</CardTitle>
          <div className="p-2 bg-red-50 rounded-lg">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">Total do período</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">Saldo</CardTitle>
          <div className={`p-2 rounded-lg ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <Wallet className={`h-4 w-4 ${balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`} />
          </div>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Receitas − Despesas</p>
        </CardContent>
      </Card>
    </div>
  )
}
