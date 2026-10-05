'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ABERTOS, type GrupoErro, type StatusErro, type StatusGravado } from '@/lib/admin/errors'
import { AlertTriangle, Loader2, HelpCircle } from 'lucide-react'
import { format } from 'date-fns'
import { AvisoMigration } from './admin-ui'

const STATUS: Record<StatusErro, { label: string; cls: string }> = {
  voltou:    { label: 'VOLTOU',     cls: 'bg-red-900 text-white dark:bg-red-600' },
  novo:      { label: 'NOVO',       cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
  analise:   { label: 'EM ANÁLISE', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
  resolvido: { label: 'RESOLVIDO',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  ignorado:  { label: 'IGNORADO',   cls: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400' },
}

type Filtro = 'abertos' | 'resolvido' | 'ignorado' | 'todos'

export function ErrorsTab({ grupos, errosIndisponiveis, statusIndisponivel, onMudou }: {
  grupos: GrupoErro[]
  errosIndisponiveis: boolean
  statusIndisponivel: boolean
  onMudou: () => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('abertos')
  const [resolvendo, setResolvendo] = useState<GrupoErro | null>(null)
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const contagem = useMemo(() => ({
    abertos: grupos.filter(g => ABERTOS.includes(g.status)).length,
    resolvido: grupos.filter(g => g.status === 'resolvido').length,
    ignorado: grupos.filter(g => g.status === 'ignorado').length,
    todos: grupos.length,
  }), [grupos])

  const visiveis = grupos.filter(g =>
    filtro === 'todos' ? true : filtro === 'abertos' ? ABERTOS.includes(g.status) : g.status === filtro)

  async function mudar(g: GrupoErro, status: StatusGravado, note?: string) {
    setSalvando(g.fingerprint)
    setErro(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const agora = new Date().toISOString()
    const { error } = await supabase.from('app_error_status').upsert({
      fingerprint: g.fingerprint,
      status,
      // A nota fica: reabrir não apaga o que foi escrito quando resolveu.
      note: note !== undefined ? (note.trim() || null) : g.registro?.note ?? null,
      resolved_at: status === 'resolvido' ? agora : null,
      updated_at: agora,
      updated_by: user?.id ?? null,
    }, { onConflict: 'fingerprint' })
    setSalvando(null)
    if (error) { setErro(`Não foi possível mudar o status: ${error.message}`); return }
    setResolvendo(null)
    onMudou()
  }

  if (errosIndisponiveis) {
    return <AvisoMigration arquivo="migration_app_errors.sql" oQue="Registro de erros indisponível." />
  }

  return (
    <div className="space-y-6">
      {statusIndisponivel && (
        <AvisoMigration arquivo="migration_admin_paineis.sql" oQue="Os erros aparecem, mas ainda não dá para marcar status." />
      )}

      <OverviewSection icon={AlertTriangle} iconClass={contagem.abertos ? 'text-red-500' : 'text-slate-400'}
        title="Erros do sistema" subtitle="agrupados por onde aconteceram e mensagem · últimos 30 dias">
        <div className="flex flex-wrap gap-2 mt-3">
          {([['abertos', 'Abertos'], ['resolvido', 'Resolvidos'], ['ignorado', 'Ignorados'], ['todos', 'Todos']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${filtro === k
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-300'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400'}`}>
              {label} ({contagem[k]})
            </button>
          ))}
        </div>

        {erro && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{erro}</p>}

        {visiveis.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            {filtro === 'abertos' ? 'Nenhum erro aberto. Tudo em ordem.' : 'Nada neste filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto mt-3 -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Onde / mensagem</th>
                  <th className="px-5 py-2 font-medium text-right">Vezes</th>
                  <th className="px-5 py-2 font-medium text-right">Usuários</th>
                  <th className="px-5 py-2 font-medium whitespace-nowrap">Última vez</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {visiveis.map(g => {
                  const st = STATUS[g.status]
                  const ocupado = salvando === g.fingerprint
                  return (
                    <tr key={g.fingerprint} className={g.status === 'voltou' ? 'bg-red-50/70 dark:bg-red-500/[0.07]' : undefined}>
                      <td className="px-5 py-3 align-top"><span className={`inline-block text-[10px] font-bold rounded-md px-2 py-0.5 whitespace-nowrap ${st.cls}`}>{st.label}</span></td>
                      <td className="px-5 py-3 min-w-[280px]">
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{g.context}</p>
                        <p className="text-slate-800 dark:text-slate-100 break-words">{g.message || '(sem mensagem)'}</p>
                        {g.status === 'voltou' && g.registro?.resolved_at && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            Resolvido em {format(new Date(g.registro.resolved_at), 'dd/MM')} · voltou {g.depoisDeResolvido}× depois disso
                          </p>
                        )}
                        {g.registro?.note && <p className="text-xs text-slate-400 mt-0.5">Nota: “{g.registro.note}”</p>}
                        {g.routes.size > 0 && <p className="text-xs text-slate-400 mt-0.5">em {[...g.routes].join(', ')}</p>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-red-600 dark:text-red-400 tabular-nums">{g.count}×</td>
                      <td className="px-5 py-3 text-right tabular-nums">{g.users.size}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{format(new Date(g.last), 'dd/MM HH:mm')}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-right">
                        {statusIndisponivel ? null : ocupado ? <Loader2 className="h-4 w-4 animate-spin text-slate-400 inline" /> : (
                          <div className="inline-flex gap-1.5">
                            {(g.status === 'novo' || g.status === 'voltou') && <Acao onClick={() => mudar(g, 'analise')}>Em análise</Acao>}
                            {ABERTOS.includes(g.status) && <Acao primaria onClick={() => { setNota(g.registro?.note ?? ''); setResolvendo(g) }}>Resolvido</Acao>}
                            {(g.status === 'novo' || g.status === 'analise') && <Acao onClick={() => mudar(g, 'ignorado')}>Ignorar</Acao>}
                            {(g.status === 'resolvido' || g.status === 'ignorado') && <Acao onClick={() => mudar(g, 'novo')}>Reabrir</Acao>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </OverviewSection>

      <details className="group bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-sm">
        <summary className="flex items-center gap-2 px-5 py-4 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200 list-none">
          <HelpCircle className="h-4 w-4 text-slate-400" /> Como funciona o status
        </summary>
        <div className="px-5 pb-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {([
            ['novo', 'apareceu e ninguém olhou ainda.'],
            ['analise', 'você está vendo o que é.'],
            ['resolvido', 'sai da lista de abertos, com a data e a nota do que foi feito.'],
            ['voltou', 'estava resolvido e aconteceu de novo depois disso — volta para o topo, em vermelho. É o sinal de que a correção não pegou.'],
            ['ignorado', 'não precisa de correção (ex.: senha digitada errada); não conta no número da aba.'],
          ] as [StatusErro, string][]).map(([s, t]) => (
            <p key={s}><span className={`inline-block text-[10px] font-bold rounded-md px-2 py-0.5 mr-2 ${STATUS[s].cls}`}>{STATUS[s].label}</span>{t}</p>
          ))}
          <p className="text-xs text-slate-400 pt-1">As ocorrências somem depois de 30 dias; o status de cada tipo fica guardado.</p>
        </div>
      </details>

      <Dialog open={!!resolvendo} onOpenChange={o => { if (!o && !salvando) setResolvendo(null) }}>
        <DialogContent>
          {resolvendo && (
            <>
              <DialogHeader>
                <DialogTitle>Marcar como resolvido?</DialogTitle>
                <DialogDescription className="font-mono text-xs">{resolvendo.context}</DialogDescription>
              </DialogHeader>
              <label className="text-xs text-slate-500">O que foi feito (opcional)</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
                placeholder="ex.: corrigido no deploy de 05/10"
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 outline-none focus:border-blue-400" />
              <p className="text-xs text-slate-400">Se acontecer de novo depois de agora, ele volta para a lista como “Voltou”.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResolvendo(null)} disabled={!!salvando}>Cancelar</Button>
                <Button onClick={() => mudar(resolvendo, 'resolvido', nota)} disabled={!!salvando}>
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Acao({ children, onClick, primaria }: { children: React.ReactNode; onClick: () => void; primaria?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${primaria
        ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5'}`}>
      {children}
    </button>
  )
}
