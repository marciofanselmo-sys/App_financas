'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { usePrimeirosPassos, ocultarPrimeirosPassos } from '@/hooks/use-primeiros-passos'
import { TrialJourneyCard } from './trial-journey-card'

/** Selo "Primeiros passos 3/10" no menu lateral; abre a gaveta com a lista. */
export function PrimeirosPassosChip() {
  const { mostrar, feitas, total, proxima } = usePrimeirosPassos()
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()
  // Trocou de tela pelo "Ir" da gaveta: fecha.
  useEffect(() => { setAberto(false) }, [pathname])
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto])

  if (!mostrar) return null
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="mx-1 mt-2 w-[calc(100%-0.5rem)] text-left rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12.5px] text-blue-900 hover:border-blue-300 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        <b>Primeiros passos</b> · {feitas.size}/{total}
        <span className="block h-1.5 mt-1.5 rounded-full bg-blue-100 dark:bg-white/10 overflow-hidden">
          <span className="block h-full bg-blue-600" style={{ width: `${(feitas.size / total) * 100}%` }} />
        </span>
        {proxima && <span className="block mt-1 text-[11px] text-blue-600 dark:text-blue-300 truncate">Próximo: {proxima.titulo.toLowerCase()} →</span>}
      </button>
      {aberto && <PrimeirosPassosGaveta onClose={() => setAberto(false)} />}
    </>
  )
}

function PrimeirosPassosGaveta({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Primeiros passos">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-[#0B2D6B]/30" />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto bg-background shadow-2xl p-4 space-y-3">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <TrialJourneyCard semHoras />
        <button type="button" onClick={() => { ocultarPrimeirosPassos(); onClose() }}
          className="block w-full text-center text-xs text-slate-400 hover:underline">
          Ocultar primeiros passos
        </button>
      </div>
    </div>
  )
}

/** Card no fim do Dashboard, para quem assinou direto. */
export function PrimeirosPassosCard() {
  const { mostrar } = usePrimeirosPassos()
  if (!mostrar) return null
  return <TrialJourneyCard semHoras />
}
