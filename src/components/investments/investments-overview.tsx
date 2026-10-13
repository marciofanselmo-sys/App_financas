'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartPie, ListOrdered, TrendingUp, Coins, ChevronRight, type LucideIcon } from 'lucide-react'
import { Goal, RICOPosition, TransactionBoard } from '@/types'
import { formatCurrency, rentColor } from '@/components/investments/rico-position-summary'
import { buildConsolidatedPatrimonyHistory, computeConsolidatedPatrimonyVariation } from '@/lib/position-history'
import { QuoteMap, dailySeries, holdingsOfBoard } from '@/lib/quotes'
import type { HistoryMap, QuoteRange } from '@/hooks/use-quotes'
import { cn } from '@/lib/utils'

// Cor fixa por classe de ativo — a mesma classe tem sempre a mesma cor.
const CLASS_COLORS: Record<string, string> = {
  'Renda Fixa': '#16a34a',
  'Ações': '#2563eb',
  'Fundos Imobiliários': '#d97706',
  'Tesouro Direto': '#0891b2',
  'Fundos de Investimento': '#7c3aed',
  'Previdência': '#db2777',
  'Cripto': '#f97316',
}
const FALLBACK = ['#7c3aed', '#db2777', '#0891b2', '#f97316', '#65a30d']
export const CASH_COLOR = '#94a3b8'
export function classColor(name: string, i = 0) {
  return CLASS_COLORS[name] ?? FALLBACK[i % FALLBACK.length]
}

const withPosition = (boards: TransactionBoard[]) => boards.filter(b => b.last_position_import)

/**
 * Classes de ativo somadas + o dinheiro parado na corretora, fechando no patrimônio.
 * `aportesOnly`: contas sem extrato, que valem a soma dos aportes — entram com
 * o nome da conta, para o gráfico fechar no mesmo total do topo.
 */
export function allocationOf(boards: TransactionBoard[], aportesOnly: { name: string; value: number }[] = []) {
  const map = new Map<string, number>()
  let cash = 0
  for (const b of withPosition(boards)) {
    const imp = b.last_position_import!
    // Valor informado à mão não tem lista de ativos: aparece com o nome da
    // conta, não como "saldo parado" (que seria patrimônio − ativos = tudo).
    if (imp.source === 'manual') {
      const label = `${b.name.trim()} · valor informado`
      map.set(label, (map.get(label) ?? 0) + imp.patrimonio)
      continue
    }
    let inAssets = 0
    for (const p of imp.positions) {
      const cat = p.category || 'Outros'
      map.set(cat, (map.get(cat) ?? 0) + p.value)
      inAssets += p.value
    }
    // O que o patrimônio tem a mais que os ativos é saldo sem aplicar.
    cash += Math.max(0, imp.patrimonio - inAssets)
  }
  for (const a of aportesOnly) {
    if (a.value <= 0.005) continue
    const label = `${a.name.trim()} · soma dos aportes`
    map.set(label, (map.get(label) ?? 0) + a.value)
  }
  const items = [...map.entries()].sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: classColor(name, i) }))
  if (cash > 0.005) items.push({ name: 'Saldo na corretora', value: cash, color: CASH_COLOR })
  return items
}

function Card({ icon: Icon, title, subtitle, action, children, className }: {
  icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <section className={cn('bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          </div>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 ml-6">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const daysAgo = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`
}
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const pctText = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%`

// ── 1. Os quatro números do topo ───────────────────────────────────────────
export function InvestmentsSummary({ boards, total: shownTotal, aportesOnlyCount = 0, contributions, target, income, goal, liveAt }: {
  boards: TransactionBoard[]
  /** Hora dos preços de hoje, quando alguma conta anda com a cotação. */
  liveAt?: string | null
  /** Quantas contas entram no total pela soma dos aportes (sem extrato). */
  aportesOnlyCount?: number
  /** Soma do valor que cada conta mostra (extrato, ou aportes sem extrato). */
  total?: number
  contributions: number
  /** Meta de investir do mês (Planejamento); 0 = sem meta. */
  target: number
  income: number
  goal: Goal | null
}) {
  const imports = withPosition(boards)
  const total = shownTotal ?? imports.reduce((s, b) => s + b.last_position_import!.patrimonio, 0)
  const lastAt = imports.map(b => b.last_position_import!.importedAt).sort().pop()
  const variation = computeConsolidatedPatrimonyVariation(boards)
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const pctOfIncome = target > 0 && income > 0 ? Math.round((target / income) * 100) : null
  const contribPct = target > 0 ? Math.min(100, (contributions / target) * 100) : 0
  const goalPct = goal && goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Patrimônio investido</p>
        <p className="text-xl font-bold mt-1 tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(total)}</p>
        <p className="text-[11px] text-slate-400 mt-1">
          {liveAt ? <>Preços de hoje · {hhmm(liveAt)}</> : lastAt ? <>Atualizado em {shortDate(lastAt)} · {daysAgo(lastAt)}</> : aportesOnlyCount > 0 ? 'Pela soma dos aportes' : 'Nenhum valor informado ainda'}
        </p>
        {lastAt && aportesOnlyCount > 0 && (
          <p className="text-[11px] text-slate-400">
            + {aportesOnlyCount} conta{aportesOnlyCount === 1 ? '' : 's'} pela soma dos aportes
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Desde a atualização anterior</p>
        {variation?.canCompare && variation.delta != null ? (
          <>
            <p className={cn('text-xl font-bold mt-1 tabular-nums', variation.delta >= 0 ? 'text-green-600' : 'text-red-500')}>
              {variation.delta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(variation.delta))}
              {variation.deltaPercent != null && (
                <span className="text-sm font-semibold"> ({variation.deltaPercent >= 0 ? '+' : ''}{variation.deltaPercent.toFixed(1).replace('.', ',')}%)</span>
              )}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">{variation.previousLabel}: {formatCurrency(variation.previous ?? 0)}</p>
          </>
        ) : (
          <p className="text-xs text-slate-400 mt-2">Atualize o valor ou importe a posição mais uma vez para comparar.</p>
        )}
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Aportes de {monthName}</p>
          <Link href="/planning" className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline">Planejamento →</Link>
        </div>
        <p className="text-xl font-bold mt-1 tabular-nums text-slate-800 dark:text-slate-100">
          {formatCurrency(contributions)}
          {target > 0 && <span className="text-sm font-medium text-slate-400"> de {formatCurrency(target)}</span>}
        </p>
        {target > 0 ? (
          <>
            <div className="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${contribPct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Meta de investir do mês{pctOfIncome != null && ` (${pctOfIncome}% da renda)`}</p>
          </>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1">Sem meta de investir neste mês.</p>
        )}
      </div>

      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-sm border border-slate-100 dark:border-white/[0.06] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Meta ligada</p>
          <Link href="/goals" className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline">Metas →</Link>
        </div>
        {goal ? (
          <>
            <p className="text-sm font-semibold mt-1 truncate text-slate-700 dark:text-slate-200">{goal.name}</p>
            <p className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
              {goalPct}% <span className="text-sm font-medium text-slate-400">de {formatCurrency(goal.targetAmount)}</span>
            </p>
            <div className="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, goalPct)}%` }} />
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 mt-2">
            Nenhuma meta puxa o valor destas contas. Em Metas, escolha &ldquo;Vincular conta&rdquo; ao criar ou editar uma meta.
          </p>
        )}
      </div>
    </div>
  )
}

// ── 2. Onde está o dinheiro ────────────────────────────────────────────────
export function AllocationCard({ boards, aportesOnly = [] }: { boards: TransactionBoard[]; aportesOnly?: { name: string; value: number }[] }) {
  const items = allocationOf(boards, aportesOnly)
  const total = items.reduce((s, i) => s + i.value, 0)
  if (items.length === 0) return null
  const hasCash = items.some(i => i.name === 'Saldo na corretora')
  return (
    <Card icon={ChartPie} title="Onde está o dinheiro" subtitle="Por classe de ativo · todas as contas">
      <div className="flex items-center gap-4 mt-4">
        <div className="h-32 w-32 shrink-0 [&_path]:stroke-white dark:[&_path]:stroke-[#111c2d]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
                {items.map(i => <Cell key={i.name} fill={i.color} />)}
              </Pie>
              <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 min-w-0 space-y-2 text-xs">
          {items.map(i => (
            <li key={i.name} className="flex items-start gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: i.color }} />
              <div className="min-w-0">
                <p className="text-slate-600 dark:text-slate-300">{i.name}</p>
                <p>
                  <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(i.value)}</span>
                  <span className="tabular-nums text-slate-400"> · {total > 0 ? Math.round((i.value / total) * 100) : 0}%</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {hasCash && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <strong className="text-slate-600 dark:text-slate-300">Saldo na corretora</strong> é o dinheiro que está na conta
          da corretora, mas ainda não foi aplicado em nenhum ativo.
        </p>
      )}
    </Card>
  )
}

// ── 3. Maiores posições (clique para ver preço médio e quantidade) ─────────
export function PositionsTable({ boards, quotes = {} }: { boards: TransactionBoard[]; quotes?: QuoteMap }) {
  const [open, setOpen] = useState<string | null>(null)
  const multi = withPosition(boards).length > 1
  const rows = useMemo(() => {
    const list: { key: string; pos: RICOPosition; board: string; value: number; price: number | null; change: number | null }[] = []
    for (const b of withPosition(boards)) {
      const holdings = new Map(holdingsOfBoard(b).map(h => [h.symbol, h]))
      for (const p of b.last_position_import!.positions) {
        // Com preço de hoje: valor = quantidade × preço; variação contra o
        // preço do extrato. Sem cotação (renda fixa, Tesouro): valor do extrato.
        const h = holdings.get(p.ticker.trim().toUpperCase())
        const q = h ? quotes[h.symbol] : undefined
        const value = h && q ? h.quantity * q.price : p.value
        list.push({
          key: `${b.id}:${p.ticker}`, pos: p, board: b.name, value,
          price: q ? q.price : null,
          change: h && q && h.priceAtImport > 0 ? (q.price / h.priceAtImport - 1) * 100 : null,
        })
      }
    }
    return list.sort((a, b) => b.value - a.value)
  }, [boards, quotes])
  if (rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.value, 0)
  const classes = [...new Set(rows.map(r => r.pos.category || 'Outros'))]
  const live = rows.some(r => r.price != null)
  const posDate = withPosition(boards).map(b => b.last_position_import!.importedAt).sort()[0]

  return (
    <Card icon={ListOrdered} title="Maiores posições"
      subtitle={live
        ? `Preço de hoje (até 30 min de atraso) e quanto mudou desde a posição de ${shortDate(posDate)}`
        : 'Clique num ativo para ver quantidade e preço médio'}
      action={<span className="text-xs text-slate-400 shrink-0">{rows.length} ativo{rows.length === 1 ? '' : 's'}</span>}>
      <div className="mt-3 overflow-x-auto">
        <table className={cn('w-full text-sm', live ? 'min-w-[620px]' : 'min-w-[520px]')}>
          <thead>
            <tr className="text-[11px] text-slate-400 uppercase tracking-wide">
              <th className="text-left font-semibold py-2">Ativo</th>
              <th className="text-left font-semibold">Classe</th>
              <th className="text-right font-semibold">Rentab.</th>
              {live && <th className="text-right font-semibold">Preço hoje</th>}
              <th className="text-right font-semibold">Valor</th>
              <th className="text-right font-semibold w-36">% da carteira</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {rows.map(({ key, pos, board, value, price, change }) => {
              const pct = total > 0 ? (value / total) * 100 : 0
              const color = classColor(pos.category || 'Outros', classes.indexOf(pos.category || 'Outros'))
              const qty = pos.quantity ? Number(pos.quantity) : NaN
              const gain = !isNaN(qty) && pos.avgPrice !== undefined && pos.lastPrice !== undefined ? (pos.lastPrice - pos.avgPrice) * qty : null
              const hasDetail = !!pos.quantity || pos.avgPrice !== undefined
              const isOpen = open === key
              return (
                <Fragment key={key}>
                  <tr
                    onClick={() => hasDetail && setOpen(isOpen ? null : key)}
                    className={cn(hasDetail && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03]')}
                  >
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-100">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform', isOpen && 'rotate-90', !hasDetail && 'invisible')} />
                        <span className="truncate" title={pos.ticker}>{pos.ticker}</span>
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 dark:text-slate-400">
                      {pos.category || 'Outros'}{pos.subcategory ? ` · ${pos.subcategory.replace(/^Renda Variável /, '')}` : ''}
                      {multi && <span className="text-slate-400"> · {board}</span>}
                    </td>
                    <td className={cn('text-right text-xs tabular-nums', rentColor(pos.rentabilidade))}>{pos.rentabilidade || '—'}</td>
                    {live && (
                      <td className="text-right tabular-nums text-xs">
                        {price != null ? (
                          <>
                            <span className="block text-slate-700 dark:text-slate-200">{formatCurrency(price)}</span>
                            {change != null && (
                              <span className={cn('block text-[11px]', change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500')}>{pctText(change)}</span>
                            )}
                          </>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                    )}
                    <td className="text-right tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(value)}</td>
                    <td className="pl-4">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="h-1.5 w-20 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs tabular-nums text-slate-500 w-11 text-right">{pct.toFixed(1).replace('.', ',')}%</span>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={live ? 6 : 5} className="pb-3 pl-6 text-xs text-slate-500 dark:text-slate-400">
                        {pos.quantity && <span>{pos.quantity} unidades</span>}
                        {pos.avgPrice !== undefined && pos.lastPrice !== undefined && (
                          <span> · preço médio {formatCurrency(pos.avgPrice)} → atual {formatCurrency(pos.lastPrice)}</span>
                        )}
                        {gain !== null && (
                          <span className={gain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                            {' '}({gain >= 0 ? '+' : '−'}{formatCurrency(Math.abs(gain))})
                          </span>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── 4. Evolução do patrimônio ──────────────────────────────────────────────
export function EvolutionCard({ boards }: { boards: TransactionBoard[] }) {
  const data = buildConsolidatedPatrimonyHistory(boards)
  if (data.length === 0) return null
  return (
    <Card icon={TrendingUp} title="Evolução do patrimônio" subtitle="Um ponto a cada importação de posição">
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} domain={['auto', 'auto']}
              tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${(Number(v) / 1000).toFixed(1).replace('.', ',')}k` : String(v))}
            />
            <Tooltip formatter={v => formatCurrency(Number(v))} labelFormatter={l => `Importação de ${l}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Line type="monotone" dataKey="patrimonio" name="Patrimônio" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.length < 3 && (
        <p className="text-[11px] text-slate-400 mt-1">Quanto mais vezes você importar a posição, mais completa fica a linha.</p>
      )}
    </Card>
  )
}

// ── 4b. Evolução dia a dia (com os preços de cada dia) ─────────────────────
const RANGE_LABEL: Record<QuoteRange, string> = { '5d': '7 dias', '1mo': '30 dias', '3mo': '3 meses', '1y': '1 ano' }

export function DailyEvolutionCard({ boards, baseTotal, history, quotes, range, onRange, loading }: {
  boards: TransactionBoard[]
  /** Soma do valor das contas sem os preços de hoje (extrato ou aportes). */
  baseTotal: number
  history: HistoryMap
  quotes: QuoteMap
  range: QuoteRange
  onRange: (r: QuoteRange) => void
  loading?: boolean
}) {
  const data = useMemo(
    () => dailySeries(boards, baseTotal, history, quotes).map(p => ({
      ...p,
      label: new Date(`${p.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    })),
    [boards, baseTotal, history, quotes],
  )
  const first = data[0]?.value ?? 0
  const last = data.at(-1)?.value ?? 0
  const delta = last - first
  const up = delta >= 0
  const color = up ? '#16a34a' : '#ef4444'

  return (
    <Card icon={TrendingUp} title="Evolução da carteira" subtitle="Dia a dia, com o preço de fechamento de cada dia"
      action={
        <div className="flex gap-1 shrink-0">
          {(Object.keys(RANGE_LABEL) as QuoteRange[]).map(r => (
            <button key={r} type="button" onClick={() => onRange(r)}
              className={cn('px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                r === range ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]')}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      }>
      {data.length < 2 ? (
        <p className="text-xs text-slate-400 mt-6 mb-4 text-center">{loading ? 'Buscando os preços…' : 'Sem preços para este período.'}</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-400">
            Resultado em {RANGE_LABEL[range]}:{' '}
            <span className={cn('text-base font-bold tabular-nums', up ? 'text-green-600' : 'text-red-500')}>
              {up ? '+' : '−'}{formatCurrency(Math.abs(delta))}
            </span>
            {first > 0 && <span className={cn('font-semibold', up ? 'text-green-600' : 'text-red-500')}> ({pctText((delta / first) * 100)})</span>}
          </p>
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} domain={['auto', 'auto']}
                  tickFormatter={v => (Math.abs(Number(v)) >= 1000 ? `${(Number(v) / 1000).toFixed(1).replace('.', ',')}k` : String(Math.round(Number(v))))}
                />
                <Tooltip formatter={v => formatCurrency(Number(v))} labelFormatter={l => `Dia ${l}`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" name="Carteira" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Usa a quantidade de hoje de cada ativo. Renda fixa, Tesouro e saldo ficam no valor do extrato.
          </p>
        </>
      )}
    </Card>
  )
}

// ── 5. Rendimentos a receber ───────────────────────────────────────────────
function eventLabel(event: string) {
  const e = (event ?? '').trim()
  if (/juros\s+sobre\s+capital/i.test(e)) return 'JCP'
  return e.charAt(0).toUpperCase() + e.slice(1).toLowerCase()
}

export function ProventosCard({ boards }: { boards: TransactionBoard[] }) {
  const [all, setAll] = useState(false)
  // Só o que ainda vai cair: pagamento com data passada já entrou na conta.
  const today = new Date().toLocaleDateString('en-CA')
  const list = withPosition(boards)
    .flatMap(b => b.last_position_import!.proventos ?? [])
    .filter(p => !p.paymentDate || p.paymentDate >= today)
    .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
  const total = list.reduce((s, p) => s + p.netValue, 0)
  const shown = all ? list : list.slice(0, 4)
  return (
    <Card icon={Coins} title="Rendimentos a receber" subtitle="Dividendos, JCP e juros já anunciados">
      {list.length === 0 ? (
        <p className="text-xs text-slate-400 mt-4">Nenhum rendimento a receber. Os anunciados na última importação já foram pagos — importe a posição de novo para ver os próximos.</p>
      ) : (
        <>
          <p className="text-xl font-bold text-green-600 mt-3 tabular-nums">
            {formatCurrency(total)} <span className="text-xs font-medium text-slate-400">em {list.length} pagamento{list.length === 1 ? '' : 's'}</span>
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {shown.map((p, i) => (
              <li key={`${p.ticker}-${p.paymentDate}-${i}`} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{p.ticker}</span>
                  <span className="text-slate-400"> · {eventLabel(p.event)} · {p.paymentDate.split('-').reverse().slice(0, 2).join('/')}</span>
                </span>
                <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200 shrink-0">{formatCurrency(p.netValue)}</span>
              </li>
            ))}
          </ul>
          {list.length > 4 && (
            <button type="button" onClick={() => setAll(v => !v)} className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
              {all ? 'Mostrar menos' : `+ ${list.length - 4} pagamentos · ver todos`}
            </button>
          )}
        </>
      )}
    </Card>
  )
}
