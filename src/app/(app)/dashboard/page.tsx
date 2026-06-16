'use client'

import { useState } from 'react'
import { useTransactions } from '@/hooks/use-transactions'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { PeriodFilter } from '@/components/dashboard/period-filter'
import { DashboardSummary } from '@/types'

export default function DashboardPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { transactions, loading } = useTransactions({ month, year })

  const summary: DashboardSummary = transactions.reduce(
    (acc, t) => {
      if (t.type === 'receita') acc.totalIncome += Number(t.amount)
      else acc.totalExpenses += Number(t.amount)
      acc.balance = acc.totalIncome - acc.totalExpenses
      return acc
    },
    { totalIncome: 0, totalExpenses: 0, balance: 0 }
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Visão geral das suas finanças</p>
        </div>
        <PeriodFilter
          month={month}
          year={year}
          onMonthChange={setMonth}
          onYearChange={setYear}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <SummaryCards summary={summary} />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-72 bg-white rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoryChart transactions={transactions} type="receita" />
          <CategoryChart transactions={transactions} type="despesa" />
        </div>
      )}
    </div>
  )
}
