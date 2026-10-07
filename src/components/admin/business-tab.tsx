'use client'

import { useMemo } from 'react'
import { Kpi, OverviewSection } from '@/components/ui/overview-blocks'
import { useAdminUsers, useCaktoEvents } from '@/hooks/use-admin-data'
import { pagaPelaCakto, ehCortesia, tierDe } from '@/lib/admin/users'
import { PLANS, PAID_TIERS, precoDe, type PaidTier } from '@/lib/plans'
import { BarChart2, Wallet, Receipt } from 'lucide-react'
import { Carregando, Erro } from './admin-ui'
import { JourneyFunnel } from './journey-funnel'
import { format, startOfWeek, subWeeks, addWeeks } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const DIA = 24 * 60 * 60 * 1000
const SEMANAS = 8

/** O que cada evento da Cakto significa, na língua do painel. */
const EVENTOS: Record<string, { label: string; cls: string }> = {
  purchase_approved:            { label: 'Compra aprovada', cls: 'pago' },
  subscription_created:         { label: 'Assinou',         cls: 'pago' },
  subscription_renewed:         { label: 'Renovou',         cls: 'pago' },
  subscription_resumed:         { label: 'Retomou',         cls: 'pago' },
  subscription_late_recovered:  { label: 'Pagou o atraso',  cls: 'pago' },
  subscription_late:            { label: 'Atrasou',         cls: 'alerta' },
  subscription_renewal_refused: { label: 'Renovação recusada', cls: 'alerta' },
  subscription_canceled:        { label: 'Cancelou',        cls: 'perda' },
  subscription_paused:          { label: 'Pausou',          cls: 'alerta' },
  refund:                       { label: 'Reembolso',       cls: 'perda' },
  chargeback:                   { label: 'Chargeback',      cls: 'perda' },
}

const TAG: Record<string, string> = {
  pago:   'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300',
  alerta: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300',
  perda:  'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300',
  outro:  'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300',
}

export function BusinessTab({ refreshKey }: { refreshKey: number }) {
  const users = useAdminUsers(refreshKey)
  const eventos = useCaktoEvents(refreshKey)

  const n = useMemo(() => {
    const lista = users.data ?? []
    const agora = users.fetchedAt
    const pagantes = lista.filter(pagaPelaCakto)

    const porPlano = PAID_TIERS.map(tier => {
      const doPlano = pagantes.filter(u => tierDe(u) === tier)
      return { tier, pagantes: doPlano.length, mrr: doPlano.length * (precoDe(tier)?.porMes ?? 0) }
    })
    const mrr = porPlano.reduce((s, p) => s + p.mrr, 0)

    const cancelados = lista.filter(u => {
      const s = u.subscription
      return s && ['canceled', 'refunded', 'chargeback'].includes(s.status)
        && s.canceled_at && agora - new Date(s.canceled_at).getTime() <= 30 * DIA
    }).length

    // Cadastros por semana (segunda a domingo), das últimas 8 semanas.
    const inicio = startOfWeek(subWeeks(new Date(), SEMANAS - 1), { weekStartsOn: 1 })
    const semanas = Array.from({ length: SEMANAS }, (_, i) => {
      const de = addWeeks(inicio, i), ate = addWeeks(inicio, i + 1)
      return {
        label: format(de, 'dd/MM', { locale: ptBR }),
        count: lista.filter(u => { const d = new Date(u.created_at); return d >= de && d < ate }).length,
      }
    })

    const proxima = pagantes
      .filter(u => u.subscription?.current_period_end && new Date(u.subscription.current_period_end).getTime() > agora)
      .sort((a, b) => a.subscription!.current_period_end!.localeCompare(b.subscription!.current_period_end!))[0] ?? null

    return {
      total: lista.length, pagantes: pagantes.length, cortesias: lista.filter(ehCortesia).length,
      mrr, porPlano, cancelados, semanas, proxima,
    }
  }, [users.data, users.fetchedAt])

  if (users.loading) return <Carregando />
  if (users.error) return <Erro msg={users.error} />

  const maxSemana = Math.max(...n.semanas.map(s => s.count), 1)
  const conversao = n.total ? Math.round((n.pagantes / n.total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Receita mensal (MRR)" value={brl(n.mrr)} sub="assinaturas pagas, valor por mês" />
        <Kpi title="Pagantes" value={String(n.pagantes)} sub={`+ ${n.cortesias} cortesia${n.cortesias !== 1 ? 's' : ''} (sem receita)`} />
        <Kpi title="Conversão grátis → pago" value={`${conversao}%`} sub={`${n.pagantes} de ${n.total} contas`} />
        <Kpi title="Cancelamentos" value={String(n.cancelados)} sub="últimos 30 dias" valueClass={n.cancelados ? 'text-red-600 dark:text-red-400' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverviewSection icon={BarChart2} title="Cadastros por semana" subtitle={`últimas ${SEMANAS} semanas, de segunda a domingo`}>
          <div className="flex items-end gap-2 h-36 mt-4">
            {n.semanas.map(s => (
              <div key={s.label} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] text-slate-400">{s.count}</span>
                <div className="w-full rounded-t-md bg-blue-600 min-h-[2px]" style={{ height: `${(s.count / maxSemana) * 100}%` }} />
                <span className="text-[10px] text-slate-400">{s.label}</span>
              </div>
            ))}
          </div>
        </OverviewSection>

        <OverviewSection icon={Wallet} title="Receita por plano" subtitle="só quem paga pela Cakto; cortesia não entra">
          <div className="mt-3 divide-y divide-dashed divide-slate-100 dark:divide-white/[0.06] text-sm">
            {n.porPlano.map(p => (
              <Linha key={p.tier}
                esq={`${PLANS[p.tier].label} · ${brl(precoDe(p.tier as PaidTier)!.total)}`}
                dir={<><b>{p.pagantes}</b> pagante{p.pagantes !== 1 ? 's' : ''} · {brl(p.mrr)}/mês</>} />
            ))}
            <Linha esq={<b>Receita anual projetada (ARR)</b>} dir={<b>{brl(n.mrr * 12)}</b>} />
            <Linha esq="Próxima renovação" dir={n.proxima
              ? `${n.proxima.full_name || n.proxima.email} · ${PLANS[tierDe(n.proxima)].label} · ${format(new Date(n.proxima.subscription!.current_period_end!), 'dd/MM/yyyy')}`
              : '—'} />
          </div>
        </OverviewSection>
      </div>

      <JourneyFunnel users={users.data ?? []} refreshKey={refreshKey} />

      <OverviewSection icon={Receipt} title="Últimos eventos de assinatura" subtitle="o que a Cakto mandou ao webhook, do mais recente para o mais antigo">
        {eventos.loading ? <Carregando /> : eventos.error ? <Erro msg={eventos.error} /> : !eventos.data?.length ? (
          <p className="text-sm text-slate-400 text-center py-8">Nenhum evento recebido ainda.</p>
        ) : (
          <div className="overflow-x-auto mt-3 -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                  <th className="px-5 py-2 font-medium">Data</th>
                  <th className="px-5 py-2 font-medium">Cliente</th>
                  <th className="px-5 py-2 font-medium">Evento</th>
                  <th className="px-5 py-2 font-medium">Processado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {eventos.data.map(e => {
                  const ev = EVENTOS[e.event] ?? { label: e.event, cls: 'outro' }
                  return (
                    <tr key={e.id}>
                      <td className="px-5 py-2.5 text-xs text-slate-500 whitespace-nowrap">{format(new Date(e.received_at), 'dd/MM/yy HH:mm')}</td>
                      <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200 max-w-[260px] truncate">{e.customer_email ?? '—'}</td>
                      <td className="px-5 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TAG[ev.cls]}`}>{ev.label}</span></td>
                      <td className="px-5 py-2.5 text-xs">
                        {e.error
                          ? <span className="text-red-600 dark:text-red-400" title={e.error}>com erro</span>
                          : e.processed ? <span className="text-emerald-600 dark:text-emerald-400">ok</span> : <span className="text-slate-400">pendente</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </OverviewSection>
    </div>
  )
}

function Linha({ esq, dir }: { esq: React.ReactNode; dir: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-slate-600 dark:text-slate-300">{esq}</span>
      <span className="text-slate-700 dark:text-slate-200 text-right">{dir}</span>
    </div>
  )
}
