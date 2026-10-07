'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Hourglass } from 'lucide-react'
import { useTrial } from '@/hooks/use-trial'
import { useSubscription } from '@/hooks/use-subscription'
import { TRIAL_MAX_BONUS_HOURS } from '@/lib/trial-config'
import { cn } from '@/lib/utils'

const HORA = 60 * 60 * 1000

/**
 * Relógio do teste grátis, no topo de todas as telas do app.
 * Só aparece para quem tem teste em andamento e não assina. Nas últimas 24h
 * fica laranja. Quando zera, some (a tela de fim do teste é outra etapa).
 */
export function TrialClock() {
  const { trial, endsAt } = useTrial()
  const { isPro, loading } = useSubscription()
  const [agora, setAgora] = useState<number | null>(null)

  useEffect(() => {
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!trial || !endsAt || loading || isPro || agora === null) return null
  const restante = endsAt.getTime() - agora
  if (restante <= 0) return null

  const dias = Math.floor(restante / (24 * HORA))
  const horas = Math.floor((restante % (24 * HORA)) / HORA)
  const minutos = Math.floor((restante % HORA) / 60000)
  const ultimoDia = restante < 24 * HORA
  const bonus = trial.bonus_hours

  return (
    <div className={cn(
      'mb-5 rounded-2xl px-4 py-3 md:px-5 md:py-3.5 text-white flex flex-wrap items-center gap-x-4 gap-y-2 shadow-[var(--nobli-shadow-m)] print:hidden',
      ultimoDia ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'nobli-gradient',
    )}>
      <Hourglass className="h-5 w-5 shrink-0 opacity-90" />
      <div className="flex-1 min-w-[180px]">
        <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
          {ultimoDia ? 'Último dia do seu teste' : 'Seu teste do NOBLI'}
        </p>
        <p className="text-sm font-semibold">
          {ultimoDia
            ? 'Assine para não perder o que você organizou.'
            : `Complete a sua jornada e ganhe até ${TRIAL_MAX_BONUS_HOURS} horas extras.`}
        </p>
        {bonus > 0 && <p className="text-[11px] opacity-85 mt-0.5">+{bonus}h ganhas de {TRIAL_MAX_BONUS_HOURS}h</p>}
      </div>
      <div className="flex gap-1.5" aria-label={`Faltam ${dias} dias, ${horas} horas e ${minutos} minutos`}>
        {[[dias, 'dias'], [horas, 'horas'], [minutos, 'min']].map(([v, l]) => (
          <div key={l as string} className="rounded-lg bg-white/15 px-2.5 py-1 text-center min-w-[48px]">
            <b className="block text-lg leading-tight tabular-nums">{v}</b>
            <span className="text-[9px] uppercase tracking-wider opacity-80">{l}</span>
          </div>
        ))}
      </div>
      <Link href="/settings/assinatura" className="rounded-lg bg-white text-blue-700 text-sm font-bold px-3.5 py-2 hover:bg-blue-50">
        Assinar
      </Link>
    </div>
  )
}
