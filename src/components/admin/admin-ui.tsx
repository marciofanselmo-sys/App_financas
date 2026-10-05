'use client'

import { AlertTriangle, Loader2 } from 'lucide-react'

/** Peças pequenas repetidas nas abas do painel Admin. */
export function Carregando() {
  return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
}

export function Erro({ msg }: { msg: string }) {
  return (
    <p className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
      {msg}
    </p>
  )
}

/** Recurso que depende de uma migration ainda não rodada no Supabase. */
export function AvisoMigration({ arquivo, oQue }: { arquivo: string; oQue: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300">
        {oQue} Rode <code className="font-mono">{arquivo}</code> no SQL Editor do Supabase.
      </p>
    </div>
  )
}

/** Barra de uso contra um limite: verde até 60%, amarela até 80%, vermelha acima. */
export function BarraLimite({ pct, cor }: { pct: number; cor?: string }) {
  const c = cor ?? (pct < 60 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${c}`} style={{ width: `${Math.min(Math.max(pct, 1.5), 100)}%` }} />
    </div>
  )
}
