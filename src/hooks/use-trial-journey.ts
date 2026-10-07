'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { TrialTaskId } from '@/lib/trial-tasks'
import { refreshTrial } from '@/hooks/use-trial'
import { trackEvent } from '@/lib/analytics/track'

/**
 * Estado da jornada do teste, compartilhado entre o card do Dashboard, os
 * avisos "+8h" e o relógio. Quem decide o que está feito é o servidor
 * (/api/teste/sincronizar).
 */
interface Estado { feitas: Set<TrialTaskId>; carregado: boolean; avisos: { id: number; tarefa: TrialTaskId; horas: number }[] }
let estado: Estado = { feitas: new Set(), carregado: false, avisos: [] }
const ouvintes = new Set<() => void>()
const mudar = (novo: Partial<Estado>) => { estado = { ...estado, ...novo }; ouvintes.forEach(f => f()) }
let ultima = 0
let emCurso: Promise<void> | null = null
let seqAviso = 0

/** Pergunta ao servidor o que já foi feito. `forcar` ignora o intervalo mínimo. */
export function sincronizarJornada(forcar = false): Promise<void> {
  const agora = Date.now()
  if (emCurso) return emCurso
  if (!forcar && agora - ultima < 8000) return Promise.resolve()
  ultima = agora
  emCurso = (async () => {
    try {
      const r = await fetch('/api/teste/sincronizar', { method: 'POST' })
      if (!r.ok) return
      const body = await r.json() as { feitas: TrialTaskId[]; novas: { id: TrialTaskId; horas: number }[] }
      const avisos = [...estado.avisos, ...body.novas.map(n => ({ id: ++seqAviso, tarefa: n.id, horas: n.horas }))]
      mudar({ feitas: new Set(body.feitas), carregado: true, avisos })
      if (body.novas.length > 0) await refreshTrial()
    } catch {
      // sem rede: tenta de novo na próxima troca de tela
    } finally {
      emCurso = null
    }
  })()
  return emCurso
}

export function dispensarAviso(id: number) {
  mudar({ avisos: estado.avisos.filter(a => a.id !== id) })
}

export function useTrialJourney() {
  return useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f) } },
    () => estado,
    () => estado,
  )
}

/** No layout: registra a visita do dia e confere a jornada a cada troca de tela. */
export function useTrialJourneySync(inTrial: boolean) {
  const pathname = usePathname()
  const visitou = useRef(false)
  useEffect(() => {
    if (!inTrial) return
    if (!visitou.current) {
      visitou.current = true
      const d = new Date()
      const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      trackEvent('visita', { key: dia })
    }
    void sincronizarJornada()
  }, [inTrial, pathname])
}
