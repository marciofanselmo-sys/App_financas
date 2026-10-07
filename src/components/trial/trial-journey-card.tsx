'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { TRIAL_TASKS, TrialTask } from '@/lib/trial-tasks'
import { TRIAL_MAX_BONUS_HOURS } from '@/lib/trial-config'
import { useTrialJourney } from '@/hooks/use-trial-journey'
import { MonthNumbersModal } from './month-numbers-modal'
import { cn } from '@/lib/utils'

/**
 * A jornada do teste no Dashboard: 10 tarefas agrupadas por etapa, com as
 * horas de cada uma e a próxima em destaque. Só aparece para quem está no teste.
 */
export function TrialJourneyCard({ semHoras = false }: { semHoras?: boolean }) {
  const { feitas, carregado } = useTrialJourney()
  const [nome, setNome] = useState<string | undefined>()
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const full = (data.user?.user_metadata?.full_name as string | undefined)?.trim()
      if (full) setNome(full.split(/\s+/)[0])
    })
  }, [])
  const [resumoAberto, setResumoAberto] = useState(false)
  const router = useRouter()
  const proxima = TRIAL_TASKS.find(t => !feitas.has(t.id)) ?? null
  const ganhas = TRIAL_TASKS.filter(t => feitas.has(t.id)).reduce((s, t) => s + t.horas, 0)
  const etapas = [...new Set(TRIAL_TASKS.map(t => t.etapa))]

  if (carregado && !proxima) return null

  const acao = (t: TrialTask) => {
    if (t.id === 'resumo') return <button type="button" onClick={() => setResumoAberto(true)} className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5">Fazer agora</button>
    if (t.href) return <Link href={t.href} className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5">Fazer agora</Link>
    return <span className="shrink-0 text-xs text-slate-500">volte amanhã</span>
  }

  return (
    <section className="nobli-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-[#0B2D6B] dark:text-slate-100">{semHoras ? 'Primeiros passos' : 'Sua jornada no NOBLI'}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {semHoras ? 'Siga estes passos para tirar o máximo do NOBLI.' : 'Cada tarefa deixa seu dinheiro mais organizado e soma horas ao seu teste.'}
          </p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">{feitas.size}/{TRIAL_TASKS.length}{semHoras ? '' : ` · +${ganhas}h de ${TRIAL_MAX_BONUS_HOURS}h`}</span>
      </div>
      <div className="mt-3 space-y-3">
        {etapas.map((etapa, i) => (
          <div key={etapa}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#93A5C1] mb-1">{i + 1} · {etapa}</p>
            {TRIAL_TASKS.filter(t => t.etapa === etapa).map(t => {
              const feita = feitas.has(t.id)
              const ehProxima = proxima?.id === t.id
              return (
                <div key={t.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
                  ehProxima && 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-300 dark:ring-blue-500/40')}>
                  <span className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    feita ? 'bg-emerald-500 border-emerald-500 text-white' : ehProxima ? 'border-blue-600' : 'border-slate-300 dark:border-slate-600')}>
                    {feita && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={cn('block', feita ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200', ehProxima && 'font-semibold')}>{t.titulo}</span>
                    {ehProxima && <span className="block text-xs text-slate-500">{t.dica}</span>}
                  </span>
                  {!semHoras && <span className={cn('shrink-0 text-xs font-extrabold rounded-full px-2 py-0.5',
                    feita ? 'bg-slate-100 text-slate-400 dark:bg-white/5' : t.horas >= 6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')}>
                    +{t.horas}h
                  </span>}
                  {ehProxima && acao(t)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <MonthNumbersModal open={resumoAberto} onClose={() => setResumoAberto(false)} nome={nome}
        proximaLabel={semHoras ? 'Próximo passo: confirmar meus fixos →' : undefined}
        onNext={() => { setResumoAberto(false); router.push('/fixos') }} />
    </section>
  )
}
