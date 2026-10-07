'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Eye, Lock, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { Feature, moeda, precoDe } from '@/lib/plans'
import { useSubscription, checkoutUrl } from '@/hooks/use-subscription'
import { trackEvent } from '@/lib/analytics/track'

/** Último mês fechado: em outubro, setembro. A vitrine abre nele. */
export function ultimoMesFechado(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  return { mes: d.getMonth() + 1, ano: d.getFullYear() }
}

const VitrineContext = createContext<{ ativo: boolean; mes: number; ano: number }>({ ativo: false, ...ultimoMesFechado() })

/** Dentro de uma tela em vitrine? As telas com mês usam para abrir no último mês fechado. */
export function useVitrine() {
  return useContext(VitrineContext)
}

// Tudo que aprofunda ou altera a tela. Rolar e passar o mouse continuam livres.
const SELETOR = 'button, a[href], input, select, textarea, [role="button"], [role="combobox"], [role="tab"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="slider"], summary, label, [contenteditable="true"]'

function alvoTrancado(t: EventTarget | null): HTMLElement | null {
  if (!(t instanceof Element)) return null
  const el = t.closest(SELETOR) as HTMLElement | null
  if (!el || el.closest('[data-vitrine-livre]')) return null
  // "Como funciona esta tela" explica a tela — fica livre.
  if (/como funciona/i.test(el.textContent ?? '')) return null
  return el
}

function rotulo(el: HTMLElement): string {
  // Filtro (select da página ou o campo escondido dentro dele)
  if (el.tagName === 'SELECT' || el.getAttribute('role') === 'combobox' || el.closest('[role="combobox"]')) return 'Trocar o filtro'
  if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) return 'Editar valores'
  // innerText e não textContent: o texto escondido dos ícones ficaria colado no nome.
  const t = (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim()
  if (!t || t.length > 40) return 'Esta ação'
  return t
}

/** Exemplo para quando a pessoa ainda não tem nada naquela tela. */
const EXEMPLOS: Record<string, { img: string; tabela: string; investimento?: boolean }> = {
  '/reports':        { img: 'relatorios', tabela: 'transactions' },
  '/investments':    { img: 'investimentos', tabela: 'transaction_boards', investimento: true },
  '/planning':       { img: 'planejamento', tabela: 'budget_plans' },
  '/goals':          { img: 'metas', tabela: 'goals' },
  '/recurring':      { img: 'parcelas', tabela: 'transactions' },
  '/fixos':          { img: 'fixos', tabela: 'transactions' },
  '/settings/rules': { img: 'regras', tabela: 'categorization_rules' },
}

function useSemDados(tabela: string | undefined, investimento?: boolean) {
  const [vazio, setVazio] = useState(false)
  useEffect(() => {
    if (!tabela) return
    let q = createClient().from(tabela).select('id', { count: 'exact', head: true })
    if (investimento) q = q.eq('is_investment', true)
    q.then(({ count, error }) => { if (!error) setVazio((count ?? 0) === 0) })
  }, [tabela, investimento])
  return vazio
}

/**
 * Modo vitrine: a tela paga abre de verdade, com os números da pessoa, mas
 * só para consulta. Qualquer botão, campo ou filtro mostra o cadeado e a
 * oferta. Usado no teste (telas fora da jornada) e no Grátis.
 */
export function VitrineFrame({ feature, pitch, children }: { feature: Feature; pitch?: string; children: React.ReactNode }) {
  const { inTrial, userId } = useSubscription()
  const pathname = usePathname()
  const exemplo = EXEMPLOS[pathname]
  const vazio = useSemDados(exemplo?.tabela, exemplo?.investimento)
  const [imgOk, setImgOk] = useState(true)
  const [acao, setAcao] = useState<string | null>(null)
  const [valor] = useState(() => ({ ativo: true, ...ultimoMesFechado() }))

  const trancar = (e: React.SyntheticEvent, abrir: boolean) => {
    const el = alvoTrancado(e.target)
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    if (abrir) {
      setAcao(rotulo(el))
      trackEvent('vitrine_clique', { key: feature })
    }
  }

  const anual = precoDe('anual')

  return (
    <VitrineContext.Provider value={valor}>
      <div className="max-w-6xl mx-auto mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        <Eye className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          {vazio
            ? <><b>Ainda não há dados seus aqui.</b> Veja abaixo como esta tela fica com os números de uma família de exemplo.</>
            : <><b>Você está vendo seus números reais.</b> </>}
          {' '}{inTrial ? 'Durante o teste' : 'No plano Grátis'}, esta tela é só para consulta: para trocar de mês, abrir detalhes, criar ou editar, assine.
        </p>
      </div>

      {vazio && exemplo && imgOk && (
        <figure className="max-w-[813px] mx-auto mb-6 nobli-card overflow-hidden">
          <figcaption className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-500 border-b border-[#DDE7F3] dark:border-white/[0.08]">
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]">Exemplo</span>
            Família Almeida Souza · dados fictícios
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/vitrine/${exemplo.img}.jpg`} alt="Exemplo desta tela com dados de uma família" className="w-full" onError={() => setImgOk(false)} />
        </figure>
      )}

      <div
        onPointerDownCapture={e => trancar(e, false)}
        onMouseDownCapture={e => trancar(e, false)}
        onClickCapture={e => trancar(e, true)}
        onKeyDownCapture={e => { if (e.key !== 'Tab') trancar(e, e.key === 'Enter' || e.key === ' ') }}
        onFocusCapture={e => { const t = e.target as HTMLElement; if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && alvoTrancado(t)) t.blur() }}
        onPasteCapture={e => trancar(e, false)}
      >
        {children}
      </div>

      <Dialog open={acao !== null} onOpenChange={v => { if (!v) setAcao(null) }}>
        <DialogContent data-vitrine-livre className="sm:max-w-sm">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-[#0B2D6B] dark:text-slate-100">
            <Lock className="h-4 w-4" /> {acao}
          </DialogTitle>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {pitch ?? 'Seus dados já estão aqui.'} {inTrial ? 'No teste, esta tela é só para consulta.' : 'No Grátis, esta tela é só para consulta.'}
          </p>
          <a href={checkoutUrl(userId, 'app_vitrine', 'anual')} target="_blank" rel="noopener noreferrer"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5">
            <Sparkles className="h-4 w-4" /> Assinar o Anual{anual ? ` · ${moeda(anual.porMes)}/mês` : ''}
          </a>
          <div className="flex justify-between text-sm">
            <Link href="/settings/assinatura" className="text-blue-600 dark:text-blue-400 hover:underline">Ver os planos</Link>
            <button type="button" onClick={() => setAcao(null)} className="text-slate-500 hover:underline">Agora não</button>
          </div>
        </DialogContent>
      </Dialog>
    </VitrineContext.Provider>
  )
}
