'use client'

import { useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useTransactions } from '@/hooks/use-transactions'
import { useCategories } from '@/hooks/use-categories'
import { realMovements } from '@/lib/internal-movement'
import { motherNameByCategory, motherOf } from '@/lib/category-tree'
import { trackEvent } from '@/lib/analytics/track'
import { sincronizarJornada } from '@/hooks/use-trial-journey'

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const CORES = ['#2563EB', '#F97316', '#1E3A8A']

/**
 * "Seu mês em números" — a recompensa da 1ª etapa da jornada: o último mês
 * fechado organizado numa tela só (ou o mês atual, se o anterior está vazio).
 * Abrir conta como a tarefa 4.
 */
export function MonthNumbersModal({ open, onClose, nome, onNext, proximaLabel }: {
  open: boolean; onClose: () => void; nome?: string; onNext?: () => void; proximaLabel?: string
}) {
  const hoje = new Date()
  const ant = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const { transactions: doAnterior } = useTransactions({ month: ant.getMonth() + 1, year: ant.getFullYear() })
  const { transactions: doAtual } = useTransactions({ month: hoje.getMonth() + 1, year: hoje.getFullYear() })
  const { categories } = useCategories()

  const usarAnterior = realMovements(doAnterior).length > 0
  const ref = usarAnterior ? ant : hoje
  const lista = useMemo(() => realMovements(usarAnterior ? doAnterior : doAtual), [usarAnterior, doAnterior, doAtual])

  const n = useMemo(() => {
    const entrou = lista.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
    const saiu = lista.filter(t => t.type === 'despesa').reduce((s, t) => s + Number(t.amount), 0)
    const maes = motherNameByCategory(categories)
    const porCat = new Map<string, number>()
    for (const t of lista) {
      if (t.type !== 'despesa') continue
      const m = motherOf(t.category, maes, 'despesa')
      porCat.set(m, (porCat.get(m) ?? 0) + Number(t.amount))
    }
    const top = [...porCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    return { entrou, saiu, sobrou: entrou - saiu, top }
  }, [lista, categories])

  useEffect(() => {
    if (!open) return
    trackEvent('resumo_visto')
    // Dá tempo do marco gravar antes de conferir a jornada.
    const t = setTimeout(() => { void sincronizarJornada(true) }, 1500)
    return () => clearTimeout(t)
  }, [open])

  const pct = n.entrou > 0 ? Math.round((n.sobrou / n.entrou) * 100) : null
  const maior = n.top[0]?.[1] ?? 1

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <div className="nobli-gradient text-white px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Seu mês em números · {MESES[ref.getMonth()]}</p>
          <DialogTitle className="text-xl font-extrabold mt-1">{nome ? `${nome}, seu` : 'Seu'} mês está organizado 🎉</DialogTitle>
          <p className="text-sm opacity-85 mt-0.5">Tudo o que entrou e saiu, num lugar só.</p>
        </div>
        <div className="px-6 pb-6 pt-4 space-y-4">
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há lançamentos para mostrar. Importe o extrato do último mês e volte aqui.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Box label="Entrou" valor={brl(n.entrou)} cls="text-green-600" />
                <Box label="Saiu" valor={brl(n.saiu)} cls="text-red-500" />
                <Box label={n.sobrou >= 0 ? 'Sobrou' : 'Faltou'} valor={brl(Math.abs(n.sobrou))} cls={n.sobrou >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}
                  sub={pct !== null && n.sobrou >= 0 ? `${pct}% da renda` : undefined} />
              </div>
              {n.top.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[#0B2D6B] dark:text-slate-100">Para onde foi seu dinheiro</p>
                  <div className="mt-2 space-y-2">
                    {n.top.map(([cat, v], i) => (
                      <div key={cat} className="flex items-center gap-3 text-sm">
                        <span className="w-28 truncate text-slate-600 dark:text-slate-300">{cat}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(v / maior) * 100}%`, backgroundColor: CORES[i] }} />
                        </div>
                        <b className="tabular-nums">{brl(v)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300">Fechar</button>
            {onNext && (
              <button type="button" onClick={onNext} className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-bold">
                {proximaLabel ?? 'Próxima tarefa: confirmar meus fixos (+6h) →'}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Box({ label, valor, cls, sub }: { label: string; valor: string; cls: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#DDE7F3] dark:border-white/[0.08] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#93A5C1]">{label}</p>
      <p className={`text-lg font-extrabold tabular-nums mt-0.5 ${cls}`}>{valor}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}
