'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Wallet, Activity, LayoutDashboard,
  ArrowLeftRight, BarChart2, CalendarCheck, Target,
  Sparkles, ArrowRight, CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Mock data ────────────────────────────────────────────────────────────────
const INCOME  = 10000
const EXPENSE = 3604.70
const BALANCE = INCOME - EXPENSE
const SCORE   = 82

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const CATEGORIES = [
  { name: 'Moradia',     amount: 1850,  color: '#6366f1' },
  { name: 'Investimento',amount: 1000,  color: '#3b82f6' },
  { name: 'Alimentação', amount: 289,   color: '#10b981' },
  { name: 'Saúde',       amount: 186,   color: '#f59e0b' },
  { name: 'iFood',       amount: 86.4,  color: '#ef4444' },
  { name: 'Assinatura',  amount: 71.8,  color: '#8b5cf6' },
  { name: 'Uber',        amount: 56.5,  color: '#06b6d4' },
  { name: 'Lazer',       amount: 65,    color: '#f97316' },
]

const TRANSACTIONS = [
  { date: '22/06', desc: 'Salário Junho',       cat: 'Salário',    type: 'receita', amount: 8500   },
  { date: '20/06', desc: 'Freelance — cliente', cat: 'Trabalho',   type: 'receita', amount: 1500   },
  { date: '18/06', desc: 'Aluguel Junho',        cat: 'Moradia',    type: 'despesa', amount: 1850   },
  { date: '17/06', desc: 'Investimento XP',      cat: 'Investimento',type:'despesa', amount: 1000   },
  { date: '15/06', desc: 'Mercado Extra',         cat: 'Alimentação',type:'despesa', amount: 289    },
  { date: '14/06', desc: 'Academia Smart Fit',    cat: 'Saúde',      type:'despesa', amount: 99     },
  { date: '13/06', desc: 'Drogasil',              cat: 'Saúde',      type:'despesa', amount: 87     },
  { date: '12/06', desc: 'Netflix',               cat: 'Assinatura', type:'despesa', amount: 49.9   },
  { date: '11/06', desc: 'iFood — Outback',       cat: 'iFood',      type:'despesa', amount: 47.9   },
  { date: '10/06', desc: 'Cinema — Lazer',        cat: 'Lazer',      type:'despesa', amount: 65     },
  { date: '09/06', desc: 'Uber',                  cat: 'Uber',       type:'despesa', amount: 34     },
  { date: '08/06', desc: 'iFood — McDonald\'s',   cat: 'iFood',      type:'despesa', amount: 38.5   },
  { date: '07/06', desc: 'Spotify',               cat: 'Assinatura', type:'despesa', amount: 21.9   },
  { date: '05/06', desc: 'Uber',                  cat: 'Uber',       type:'despesa', amount: 22.5   },
]

const PLANNING = [
  { cat: 'Moradia',     planned: 1900, actual: 1850, color: '#6366f1' },
  { cat: 'Alimentação', planned: 400,  actual: 289,  color: '#10b981' },
  { cat: 'Saúde',       planned: 150,  actual: 186,  color: '#f59e0b' },
  { cat: 'iFood',       planned: 100,  actual: 86.4, color: '#ef4444' },
  { cat: 'Lazer',       planned: 150,  actual: 65,   color: '#f97316' },
  { cat: 'Assinatura',  planned: 100,  actual: 71.8, color: '#8b5cf6' },
]

const GOALS = [
  { name: 'Reserva de emergência', type: 'Reserva', current: 8500,  target: 30000, color: '#3b82f6', months: 14 },
  { name: 'Viagem para Europa',    type: 'Viagem',  current: 3200,  target: 25000, color: '#8b5cf6', months: 18 },
]

const MONTHLY_EVOLUTION = [
  { month: 'Jan', income: 8500,  expenses: 3200 },
  { month: 'Fev', income: 8500,  expenses: 3800 },
  { month: 'Mar', income: 9200,  expenses: 3600 },
  { month: 'Abr', income: 8500,  expenses: 4100 },
  { month: 'Mai', income: 10500, expenses: 3900 },
  { month: 'Jun', income: 10000, expenses: 3605 },
]

type Section = 'dashboard' | 'transacoes' | 'analise' | 'planejamento' | 'metas'

const NAV = [
  { id: 'dashboard'    as Section, label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'transacoes'   as Section, label: 'Movimentações',icon: ArrowLeftRight  },
  { id: 'analise'      as Section, label: 'Análise',       icon: BarChart2       },
  { id: 'planejamento' as Section, label: 'Planejamento',  icon: CalendarCheck   },
  { id: 'metas'        as Section, label: 'Metas',         icon: Target          },
]

// ── Componentes ──────────────────────────────────────────────────────────────
function SectionDashboard() {
  const maxBar = Math.max(...MONTHLY_EVOLUTION.map(m => m.income))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Junho 2026</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Receitas</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-emerald-600 dark:text-emerald-400 leading-none tabular-nums">{fmt(INCOME)}</p>
          <p className="text-xs text-slate-400 mt-2">Total do período</p>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Despesas</span>
            <div className="h-8 w-8 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-red-500 leading-none tabular-nums">{fmt(EXPENSE)}</p>
          <p className="text-xs text-slate-400 mt-2">Total do período</p>
        </div>
        <div className="bg-blue-600 rounded-2xl p-5 shadow-md shadow-blue-600/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">Saldo</span>
            <div className="h-8 w-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-white leading-none tabular-nums">{fmt(BALANCE)}</p>
          <p className="text-xs text-white/50 mt-2">Receitas − Despesas</p>
        </div>
        <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Saúde</span>
            <div className="h-8 w-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
          </div>
          <p className="text-[1.6rem] font-bold text-blue-500 leading-none tabular-nums">{SCORE}</p>
          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${SCORE}%` }} />
          </div>
          <p className="text-xs mt-1.5 font-semibold text-blue-500">Bom</p>
        </div>
      </div>

      {/* Evolução */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-white/[0.06]">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-5">Evolução dos últimos 6 meses</h2>
        <div className="flex items-end gap-3 h-36">
          {MONTHLY_EVOLUTION.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 items-end h-28">
                <div className="flex-1 rounded-t-md bg-emerald-400/80 dark:bg-emerald-500/60 transition-all" style={{ height: `${(m.income / maxBar) * 100}%` }} />
                <div className="flex-1 rounded-t-md bg-red-400/70 dark:bg-red-500/60 transition-all" style={{ height: `${(m.expenses / maxBar) * 100}%` }} />
              </div>
              <span className="text-[10px] text-slate-400">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" />Receitas</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-red-400" />Despesas</div>
        </div>
      </div>

      {/* Diagnóstico */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 shadow-md shadow-blue-600/20 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-200" />
          <span className="text-xs font-semibold text-blue-200 uppercase tracking-wide">Diagnóstico do mês</span>
        </div>
        <p className="text-sm leading-relaxed text-blue-50">
          Em Junho suas receitas somaram <strong className="text-white">{fmt(INCOME)}</strong> e as despesas ficaram em <strong className="text-white">{fmt(EXPENSE)}</strong>, gerando um saldo positivo de <strong className="text-white">{fmt(BALANCE)}</strong>. O maior gasto foi com Moradia (<strong className="text-white">R$ 1.850</strong>), seguido de Investimento (<strong className="text-white">R$ 1.000</strong>).
        </p>
        <p className="text-xs text-blue-200 mt-2">Você investiu 10% da renda. Meta recomendada: 20%.</p>
      </div>
    </div>
  )
}

function SectionTransacoes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Movimentações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Junho 2026 · {TRANSACTIONS.length} transações</p>
      </div>
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-white/[0.06]">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Data</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Descrição</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Categoria</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {TRANSACTIONS.map((t, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                <td className="px-5 py-3 text-xs text-slate-400">{t.date}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-200 font-medium">{t.desc}</td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{t.cat}</span>
                </td>
                <td className={`px-5 py-3 text-right font-semibold ${t.type === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {t.type === 'receita' ? '+' : '-'}{fmt(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionAnalise() {
  const total = CATEGORIES.reduce((s, c) => s + c.amount, 0)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Análise</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gastos por categoria · Junho 2026</p>
      </div>
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-white/[0.06] space-y-4">
        {CATEGORIES.map(cat => (
          <div key={cat.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{cat.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{((cat.amount / total) * 100).toFixed(1)}%</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fmt(cat.amount)}</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(cat.amount / total) * 100}%`, backgroundColor: cat.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionPlanejamento() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Planejamento</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Planejado × Realizado · Junho 2026</p>
      </div>
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-white/[0.06]">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Categoria</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Planejado</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Realizado</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Diferença</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {PLANNING.map(row => {
              const diff = row.actual - row.planned
              const pct  = row.actual / row.planned
              const status = pct <= 0.9 ? 'ok' : pct <= 1 ? 'atencao' : 'estourado'
              return (
                <tr key={row.cat} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                      <span className="text-slate-700 dark:text-slate-200">{row.cat}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">{fmt(row.planned)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-red-500">{fmt(row.actual)}</td>
                  <td className="px-5 py-3 text-right font-semibold">
                    <span className={diff <= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {diff > 0 ? '+' : ''}{fmt(diff)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {status === 'ok'       && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle  className="h-3 w-3" /> OK</span>}
                    {status === 'atencao'  && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500"><AlertTriangle  className="h-3 w-3" /> Atenção</span>}
                    {status === 'estourado'&& <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500"><XCircle         className="h-3 w-3" /> Estourado</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionMetas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Metas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{GOALS.length} objetivos em andamento</p>
      </div>
      <div className="space-y-4">
        {GOALS.map(g => {
          const pct = Math.round((g.current / g.target) * 100)
          return (
            <div key={g.name} className="bg-white dark:bg-[#111c2d] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: g.color + '20' }}>
                    <Target className="h-5 w-5" style={{ color: g.color }} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{g.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{g.type}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">No prazo</span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(g.current)}</span>
                  <span className="text-slate-400">{fmt(g.target)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{pct}% concluído</span>
                  <span>{fmt(g.target - g.current)} restando</span>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
                <div>
                  <p>Necessário/mês</p>
                  <p className="font-bold text-slate-700 dark:text-slate-200">{fmt((g.target - g.current) / g.months)}</p>
                </div>
                <div>
                  <p>Previsão</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{g.months} meses</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [section, setSection] = useState<Section>('dashboard')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0d1424] flex flex-col">
      {/* Banner CTA */}
      <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 z-50">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-blue-200 shrink-0" />
          <span className="text-blue-100">Você está explorando o <strong className="text-white">FinanceApp</strong> com dados de demonstração.</span>
        </div>
        <Link href="/auth/register">
          <Button size="sm" className="bg-white text-blue-600 hover:bg-blue-50 gap-1.5 shrink-0 font-semibold text-xs h-8">
            Criar conta grátis <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 h-[calc(100vh-44px)] sticky top-[44px] bg-white dark:bg-[#111c2d] border-r border-slate-200/80 dark:border-white/[0.06] flex-col shrink-0">
          <div className="px-5 py-5 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">FinanceApp</span>
                <p className="text-[10px] text-blue-500 dark:text-blue-400 leading-none mt-0.5 font-semibold">MODO DEMO</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = section === id
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                  {label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500" />}
                </button>
              )
            })}
          </nav>
          <div className="px-4 pb-5 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <Link href="/auth/register" className="block">
              <Button className="w-full gap-2 text-sm">
                Criar minha conta <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-[11px] text-center text-slate-400 mt-2">
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-blue-500 hover:underline">Entrar</Link>
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {/* Mobile nav */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl mb-6 md:hidden overflow-x-auto">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  section === id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <div className="max-w-4xl mx-auto">
            {section === 'dashboard'    && <SectionDashboard />}
            {section === 'transacoes'   && <SectionTransacoes />}
            {section === 'analise'      && <SectionAnalise />}
            {section === 'planejamento' && <SectionPlanejamento />}
            {section === 'metas'        && <SectionMetas />}
          </div>
        </main>
      </div>
    </div>
  )
}
