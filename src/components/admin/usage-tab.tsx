'use client'

import { useMemo } from 'react'
import { Kpi, OverviewSection } from '@/components/ui/overview-blocks'
import { useAdminUsers, useDbSize, useUsageByUser } from '@/hooks/use-admin-data'
import { usoPorCliente } from '@/lib/admin/usage'
import { LIMITES, formatBytes } from '@/lib/admin/limits'
import { tierDe, pagaPelaCakto, ehCortesia } from '@/lib/admin/users'
import { PLANS } from '@/lib/plans'
import { Database } from 'lucide-react'
import { AvisoMigration, BarraLimite, Carregando, Erro } from './admin-ui'

const n = (v: number) => v.toLocaleString('pt-BR')

export function UsageTab({ refreshKey }: { refreshKey: number }) {
  const users = useAdminUsers(refreshKey)
  const uso = useUsageByUser(refreshKey)
  const db = useDbSize(refreshKey)

  const clientes = useMemo(
    () => usoPorCliente(users.data ?? [], uso.data ?? []),
    [users.data, uso.data],
  )

  if (users.loading || uso.loading || db.loading) return <Carregando />
  if (users.error) return <Erro msg={users.error} />
  if (uso.error || db.error) {
    return <AvisoMigration arquivo="migration_admin_paineis.sql" oQue="O uso por cliente ainda não está disponível." />
  }

  const total = clientes.reduce((s, c) => s + c.bytes, 0)
  const media = clientes.length ? total / clientes.length : 0
  const tamanho = db.data ?? 0
  const livre = Math.max(LIMITES.supabaseDb.limite - tamanho, 0)
  const cabem = media > 0 ? Math.floor(livre / media) : null
  const maior = clientes[0]
  const pctMaior = total > 0 && maior ? Math.round((maior.bytes / total) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Tamanho do banco" value={formatBytes(tamanho)} sub={`de ${formatBytes(LIMITES.supabaseDb.limite)} no plano grátis`} />
        <Kpi title="Dados dos clientes" value={formatBytes(total)} sub="o resto é estrutura e índices do Supabase" />
        <Kpi title="Média por cliente" value={formatBytes(media)} sub={cabem != null ? `≈ ${n(cabem)} clientes cabem no espaço livre` : 'sem dados ainda'} />
        <Kpi title="Cliente mais pesado" value={`${pctMaior}%`} sub={maior ? `dos dados é de ${maior.user.full_name || maior.user.email}` : '—'} />
      </div>

      <OverviewSection icon={Database} title="Espaço por cliente" subtitle="ordenado do maior para o menor">
        <div className="overflow-x-auto mt-3 -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                <th className="px-5 py-2 font-medium">Cliente</th>
                <th className="px-5 py-2 font-medium">Plano</th>
                <th className="px-5 py-2 font-medium text-right">Transações</th>
                <th className="px-5 py-2 font-medium text-right">Contas</th>
                <th className="px-5 py-2 font-medium text-right">Categorias</th>
                <th className="px-5 py-2 font-medium text-right">Regras</th>
                <th className="px-5 py-2 font-medium text-right">Importações</th>
                <th className="px-5 py-2 font-medium text-right">Espaço</th>
                <th className="px-5 py-2 font-medium w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {clientes.map(c => {
                const tier = tierDe(c.user)
                const pct = total > 0 ? (c.bytes / total) * 100 : 0
                const tag = pagaPelaCakto(c.user) ? ['Pago', 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300']
                  : ehCortesia(c.user) ? ['Cortesia', 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300']
                  : [null, 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400']
                return (
                  <tr key={c.user.id}>
                    <td className="px-5 py-2.5 max-w-[220px]">
                      <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{c.user.full_name || c.user.email.split('@')[0]}</p>
                      <p className="text-xs text-slate-400 truncate">{c.user.email}</p>
                    </td>
                    <td className="px-5 py-2.5 whitespace-nowrap">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tag[1]}`}>
                        {PLANS[tier].label}{tag[0] ? ` · ${tag[0]}` : ''}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{n(c.transacoes)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{n(c.contas)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{n(c.categorias)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{n(c.regras)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{n(c.importacoes)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap">{formatBytes(c.bytes)}</td>
                    <td className="px-5 py-2.5">
                      <BarraLimite pct={pct} cor="bg-blue-500" />
                      <p className="text-[11px] text-slate-400 mt-1">{Math.round(pct)}% dos dados</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] border border-dashed border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5">
          O espaço é <b>estimado</b>: o banco não separa MB por cliente, então contamos as linhas de cada um em cada tabela e multiplicamos pelo tamanho médio da linha daquela tabela. Importações são as feitas desde que a contagem começou.
        </p>
      </OverviewSection>
    </div>
  )
}
