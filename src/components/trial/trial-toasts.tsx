'use client'

import { useEffect } from 'react'
import { dispensarAviso, useTrialJourney } from '@/hooks/use-trial-journey'
import { TRIAL_TASK_BY_ID } from '@/lib/trial-tasks'

/** Aviso "+8h · tarefa concluída" no canto da tela, some sozinho em 6s. */
export function TrialToasts() {
  const { avisos } = useTrialJourney()
  useEffect(() => {
    if (avisos.length === 0) return
    const t = setTimeout(() => dispensarAviso(avisos[0].id), 6000)
    return () => clearTimeout(t)
  }, [avisos])
  if (avisos.length === 0) return null
  return (
    <div className="fixed z-50 right-4 bottom-24 md:bottom-6 flex flex-col gap-2 print:hidden">
      {avisos.slice(0, 3).map(a => (
        <button key={a.id} type="button" onClick={() => dispensarAviso(a.id)}
          className="flex items-center gap-3 rounded-xl bg-[#0B2D6B] text-white px-4 py-3 shadow-[var(--nobli-shadow-m)] text-left animate-in slide-in-from-bottom-2">
          <b className="text-xl text-emerald-300 tabular-nums">+{a.horas}h</b>
          <span className="text-sm">
            <span className="block font-semibold">{TRIAL_TASK_BY_ID[a.tarefa]?.titulo ?? 'Tarefa concluída'}</span>
            <span className="block text-xs opacity-75">Seu teste ganhou {a.horas} horas</span>
          </span>
        </button>
      ))}
    </div>
  )
}
