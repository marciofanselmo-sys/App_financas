'use client'

import { useMemo, useState } from 'react'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { useProductEvents } from '@/hooks/use-admin-data'
import type { AdminUser } from '@/lib/admin/types'
import { pagaPelaCakto } from '@/lib/admin/users'
import { Filter } from 'lucide-react'
import { AvisoMigration, Carregando } from './admin-ui'

const DIA = 24 * 60 * 60 * 1000
const JANELAS = [7, 30, 90] as const

/**
 * Funil depois do cadastro: das contas criadas na janela, quantas chegaram a
 * cada marco. É a "foto de antes" do teste de 7 dias — o mesmo funil vai
 * mostrar as tarefas e o fim do teste quando eles existirem.
 */
export function JourneyFunnel({ users, refreshKey }: { users: AdminUser[]; refreshKey: number }) {
  const eventos = useProductEvents(refreshKey)
  const [dias, setDias] = useState<(typeof JANELAS)[number]>(30)

  const etapas = useMemo(() => {
    // Referência de "agora" = quando os dados chegaram (mesmo padrão das outras abas).
    const agora = eventos.fetchedAt
    const coorte = users.filter(u => agora - new Date(u.created_at).getTime() <= dias * DIA && u.role !== 'admin')
    const ids = new Set(coorte.map(u => u.id))
    const quem = (ev: string) => new Set((eventos.data ?? []).filter(e => e.event === ev && ids.has(e.user_id)).map(e => e.user_id)).size
    return [
      { label: 'Criaram conta no app', n: coorte.length },
      { label: 'Começaram o teste de 7 dias', n: quem('teste_inicio') },
      { label: 'Criaram a 1ª conta ou cartão', n: quem('primeira_conta') },
      { label: 'Importaram o 1º extrato', n: quem('primeira_importacao') },
      { label: 'Abriram uma tela do plano pago', n: quem('bloqueio_visto') },
      { label: 'Assinaram', n: coorte.filter(pagaPelaCakto).length },
    ]
  }, [users, eventos.data, eventos.fetchedAt, dias])

  // De onde vieram os testes (utm_source do link /teste-gratis) e quantos assinaram.
  const origens = useMemo(() => {
    const agora = eventos.fetchedAt
    const naJanela = new Map(users.filter(u => agora - new Date(u.created_at).getTime() <= dias * DIA && u.role !== 'admin').map(u => [u.id, u]))
    const porOrigem = new Map<string, { comecaram: number; assinaram: number }>()
    for (const e of eventos.data ?? []) {
      if (e.event !== 'teste_inicio' || !naJanela.has(e.user_id)) continue
      const origem = String((e.props?.utm_source as string | undefined) || 'sem origem').toLowerCase()
      const linha = porOrigem.get(origem) ?? { comecaram: 0, assinaram: 0 }
      linha.comecaram++
      if (pagaPelaCakto(naJanela.get(e.user_id)!)) linha.assinaram++
      porOrigem.set(origem, linha)
    }
    return [...porOrigem.entries()].sort((a, b) => b[1].comecaram - a[1].comecaram)
  }, [users, eventos.data, eventos.fetchedAt, dias])

  const base = etapas[0].n || 1

  return (
    <OverviewSection icon={Filter} title="Jornada depois do cadastro" subtitle="das contas criadas no período, quantas chegaram a cada passo">
      <div className="flex gap-1.5 mt-3">
        {JANELAS.map(j => (
          <button key={j} type="button" onClick={() => setDias(j)}
            className={`text-xs rounded-full border px-3 py-1 ${dias === j ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
            {j} dias
          </button>
        ))}
      </div>
      {eventos.loading ? <Carregando /> : eventos.error ? (
        <div className="mt-3"><AvisoMigration arquivo="migration_product_events.sql" oQue="A jornada depois do cadastro ainda não está sendo medida." /></div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {etapas.map((e, i) => {
            const pct = Math.round((e.n / base) * 100)
            return (
              <div key={e.label} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-300">{e.label}</span>
                  <span className="tabular-nums text-slate-500"><b className="text-slate-800 dark:text-slate-100">{e.n}</b>{i > 0 && ` · ${pct}%`}</span>
                </div>
                <div className="h-2 mt-1 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${i === 0 ? 100 : pct}%` }} />
                </div>
              </div>
            )
          })}
          <div className="pt-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Testes por origem</p>
            {origens.length === 0 ? (
              <p className="text-xs text-slate-400 mt-1">Nenhum teste começou neste período.</p>
            ) : (
              <table className="w-full text-sm mt-1.5">
                <thead><tr className="text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="text-left font-semibold py-1">Origem</th><th className="text-right font-semibold">Começaram</th><th className="text-right font-semibold">Assinaram</th>
                </tr></thead>
                <tbody>
                  {origens.map(([o, l]) => (
                    <tr key={o} className="border-t border-slate-100 dark:border-white/[0.06]">
                      <td className="py-1.5 capitalize text-slate-600 dark:text-slate-300">{o}</td>
                      <td className="text-right tabular-nums font-semibold">{l.comecaram}</td>
                      <td className="text-right tabular-nums">{l.assinaram}{l.comecaram > 0 && <span className="text-slate-400"> · {Math.round((l.assinaram / l.comecaram) * 100)}%</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-[11px] text-slate-400 mt-1">A origem vem do final do link (utm_source). “Sem origem” = entrou pelo link sem etiqueta.</p>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">Medido desde a entrada desta medição; quem se cadastrou antes dela aparece sem os passos.</p>
        </div>
      )}
    </OverviewSection>
  )
}
