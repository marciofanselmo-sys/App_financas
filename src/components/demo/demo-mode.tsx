'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CheckCircle2, PlayCircle, Sparkles, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { DEMO_BLOCKED_EVENT, DEMO_EMAIL, TOUR_REPORT_EVENT, TOUR_REPORT_TAB, clearDemoCookie, isDemoClient, trackDemo } from '@/lib/demo'

/** Sai da conta da demo e vai para o cadastro do teste grátis. */
const CTA_HREF = '/demo/sair?para=teste'
const TOUR_KEY = 'nobli_demo_tour'

interface Step { path: string; target?: string; tab?: 'mensal' | 'anual'; title: string; text: string }

// Uma história: o app organizou tudo sozinho → mostrou para onde vai o
// dinheiro → ajudou a planejar → entregou o ano pronto. Termina no convite.
const STEPS: Step[] = [
  {
    path: '/dashboard', target: '[data-tour="fluxo"]',
    title: 'O mês num olhar só',
    text: 'Receitas, despesas, o que sobrou e a saúde do mês da família — tudo montado sozinho a partir dos extratos do banco.',
  },
  {
    path: '/dashboard', target: '[data-tour="categorias"]',
    title: 'Para onde foi o dinheiro',
    text: 'Cada gasto do extrato cai na categoria certa, sem digitar nada. Dá para ver na hora o que pesou no mês.',
  },
  {
    path: '/transactions',
    title: 'Todas as contas num lugar só',
    text: 'Conta do Itaú, Nubank, cartão C6 e investimentos juntos. O único trabalho é subir o extrato do banco — C6, Inter, Nubank, Itaú, Mercado Pago ou qualquer OFX/CSV.',
  },
  {
    path: '/recurring',
    title: 'Quanto já está comprometido',
    text: 'Toda compra parcelada nos cartões: quanto ainda falta pagar e em que mês termina. Sem planilha.',
  },
  {
    path: '/fixos',
    title: 'As contas fixas, encontradas sozinhas',
    text: 'Aluguel, escola, assinaturas: o app reconhece o que se repete todo mês e mostra quanto da renda já tem dono.',
  },
  {
    path: '/planning',
    title: 'Quanto pode gastar em cada coisa',
    text: 'A renda dividida em essencial, estilo de vida e futuro (50/30/20), com limite por categoria e aviso quando passa.',
  },
  {
    path: '/reports', tab: 'mensal', target: '[data-tour="rel-mensal"]',
    title: 'O mês fechado, explicado',
    text: 'O relatório do mês vem com destaques automáticos: o que subiu, o que pesou e quanto sobrou — pronto para ler em 1 minuto.',
  },
  {
    path: '/reports', tab: 'anual', target: '[data-tour="rel-anual"]',
    title: 'O ano inteiro, pronto',
    text: 'Melhor e pior mês, categorias do ano e a comparação com o ano anterior. Também sai em PDF.',
  },
  {
    path: '/reports', tab: 'anual', target: '[data-tour="rel-eventos"]',
    title: 'Quanto custou cada viagem',
    text: 'Viagens, festas e reformas separadas do dia a dia: quanto custou cada uma e quanto sobraria no ano sem elas.',
  },
]

/** A partir deste passo o balão já oferece o teste grátis (quem se convenceu não precisa ir até o fim). */
const CTA_FROM = 6

function readStep(): number | 'done' | null {
  try {
    const v = sessionStorage.getItem(TOUR_KEY)
    if (v === 'done') return 'done'
    return v == null ? null : Number(v)
  } catch { return null }
}
function writeStep(v: number | 'done') {
  try { sessionStorage.setItem(TOUR_KEY, String(v)) } catch { /* sem sessão: o tour só não lembra o passo */ }
}

/**
 * Modo demonstração: faixa no topo, tour de 5 paradas e convite para o teste
 * grátis quando a pessoa tenta gravar algo. Só aparece na conta da demo.
 */
export function DemoMode() {
  const [on, setOn] = useState(false)
  const [step, setStep] = useState<number | null>(null)
  const [invite, setInvite] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Liga só com o cookie E a sessão da conta da demo (o cookie sozinho não basta).
  useEffect(() => {
    if (!isDemoClient()) return
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email?.toLowerCase() === DEMO_EMAIL.toLowerCase()) {
        setOn(true)
        const saved = readStep()
        const wantsTour = new URLSearchParams(window.location.search).get('tour') === '1'
        if (typeof saved === 'number') setStep(saved)
        else if (saved === null && wantsTour) { setStep(0); writeStep(0) }
      } else {
        clearDemoCookie()
      }
    })
  }, [])

  useEffect(() => {
    if (!on) return
    const open = (e: Event) => { setInvite(true); trackDemo('demo_bloqueio', String((e as CustomEvent).detail ?? '').split(':')[0]) }
    window.addEventListener(DEMO_BLOCKED_EVENT, open)
    return () => window.removeEventListener(DEMO_BLOCKED_EVENT, open)
  }, [on])

  const go = useCallback((i: number) => {
    setStep(i)
    writeStep(i)
    trackDemo('demo_tour', String(i + 1))
    const tab = STEPS[i].tab
    if (tab) {
      try { sessionStorage.setItem(TOUR_REPORT_TAB, tab) } catch { /* sem sessão */ }
      window.dispatchEvent(new CustomEvent(TOUR_REPORT_EVENT, { detail: tab }))
    }
    if (STEPS[i].path !== pathname) router.push(STEPS[i].path)
  }, [pathname, router])

  const close = () => {
    setStep(null)
    writeStep('done')
    try { sessionStorage.removeItem(TOUR_REPORT_TAB) } catch { /* sem sessão */ }
  }
  const [finale, setFinale] = useState(false)
  const finish = () => { close(); setFinale(true); trackDemo('demo_tour', 'fim') }

  if (!on) return null
  const current = step != null && STEPS[step] && STEPS[step].path === pathname ? STEPS[step] : null

  return (
    <>
      <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-4 md:mb-6 px-4 md:px-8 py-2.5 bg-gradient-to-r from-[#0B2D6B] to-[#2563EB] text-white flex flex-wrap items-center gap-x-3 gap-y-2 text-sm print:hidden">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-bold tracking-wide">DEMONSTRAÇÃO</span>
        <span className="min-w-0 flex-1 text-white/90">Você está vendo a família Almeida Souza <span className="hidden sm:inline">(dados de exemplo)</span></span>
        <button type="button" onClick={() => go(0)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-2.5 py-1 text-xs font-medium hover:bg-white/10">
          <PlayCircle className="h-3.5 w-3.5" /> Tour guiado{step != null ? ` ${step + 1}/${STEPS.length}` : ''}
        </button>
        <a href={CTA_HREF} onClick={() => trackDemo('demo_cta', 'faixa')}
          className="rounded-lg bg-white px-3 py-1.5 text-xs sm:text-[13px] font-bold text-[#1d4ed8] hover:bg-blue-50">
          Criar minha conta grátis — 7 dias
        </a>
      </div>

      {current && <TourBalloon step={step!} data={current} total={STEPS.length} onNext={() => (step! + 1 < STEPS.length ? go(step! + 1) : finish())} onSkip={close} />}

      {/* Fechamento do tour */}
      <Dialog open={finale} onOpenChange={setFinale}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-xl font-extrabold text-[#0B2D6B] dark:text-slate-100 leading-snug">
            Você acabou de ver o ano inteiro da família Almeida Souza.
          </DialogTitle>
          <p className="text-sm text-slate-600 dark:text-slate-300">Com o extrato do <strong>seu</strong> banco, o seu fica pronto hoje:</p>
          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
            {['Gastos categorizados sozinhos', 'Parcelas e contas fixas encontradas', 'Relatório do mês e do ano prontos'].map(t => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />{t}</li>
            ))}
          </ul>
          <a href={CTA_HREF} onClick={() => trackDemo('demo_cta', 'fim')}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-[15px] font-bold text-white hover:bg-[#1d4ed8]">
            <Sparkles className="h-4 w-4" /> Começar meu teste grátis de 7 dias
          </a>
          <button type="button" onClick={() => setFinale(false)} className="text-xs text-slate-400 hover:text-slate-600">
            Continuar explorando a demonstração
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={invite} onOpenChange={setInvite}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle className="text-lg font-extrabold text-[#0B2D6B] dark:text-slate-100">Na sua conta, isso funciona 🙂</DialogTitle>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Esta é uma demonstração, só para ver. Importe o extrato do <strong>seu</strong> banco e veja o seu mês organizado assim
            em poucos minutos — categorias, parcelas e fixos já separados.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['C6', 'Inter', 'Nubank', 'Itaú', 'Mercado Pago', 'OFX / CSV'].map(b => (
              <span key={b} className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[11px] text-slate-500">{b}</span>
            ))}
          </div>
          <a href={CTA_HREF} onClick={() => trackDemo('demo_cta', 'convite')}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1d4ed8]">
            <Sparkles className="h-4 w-4" /> Começar meu teste grátis de 7 dias
          </a>
          <button type="button" onClick={() => setInvite(false)} className="text-xs text-slate-400 hover:text-slate-600">
            Continuar vendo a demonstração
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TourBalloon({ step, data, total, onNext, onSkip }: {
  step: number; data: Step; total: number; onNext: () => void; onSkip: () => void
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const last = step === total - 1

  // Acha o alvo (a tela pode ainda estar carregando) e acompanha rolagem.
  useLayoutEffect(() => {
    if (!data.target) { setRect(null); return }
    let tries = 0
    let el: Element | null = null
    let timer: ReturnType<typeof setTimeout>
    const measure = () => { if (el) setRect(el.getBoundingClientRect()) }
    const find = () => {
      el = document.querySelector(data.target!)
      if (el && el.getBoundingClientRect().height > 40) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(measure, 450)
      } else if (tries++ < 30) {
        timer = setTimeout(find, 150)
      }
    }
    find()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(timer); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure) }
  }, [data.target])

  const W = 320
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  let style: React.CSSProperties
  if (rect) {
    const below = vh - rect.bottom > 290
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12)
    style = below ? { top: rect.bottom + 12, left } : { top: Math.max(12, rect.top - 280), left }
  } else {
    // Sem alvo: o balão fica embaixo, a tela inteira à vista.
    style = { bottom: 88, left: Math.max(12, vw / 2 - W / 2) }
  }

  return (
    <div className="print:hidden">
      {rect && (
        <div className="fixed z-[60] pointer-events-none rounded-2xl ring-[3px] ring-[#2563EB] transition-all"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: '0 0 0 9999px rgba(15,23,42,0.45)' }} />
      )}
      <div className="fixed z-[61] rounded-2xl bg-white dark:bg-[#111c2d] shadow-2xl border border-slate-100 dark:border-white/10 p-4" style={{ ...style, width: W, maxWidth: 'calc(100vw - 24px)' }}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-bold text-[#2563EB]">{step + 1} DE {total}</p>
          <button type="button" onClick={onSkip} aria-label="Fechar tour" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
          <div className="h-full bg-[#2563EB] transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <p className="mt-2 text-[15px] font-bold text-[#0B2D6B] dark:text-slate-100">{data.title}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{data.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-600">Pular tour</button>
          <button type="button" onClick={onNext} className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8]">
            {last ? 'Concluir ✓' : 'Próximo →'}
          </button>
        </div>
        {step >= CTA_FROM && !last && (
          <a href={CTA_HREF} onClick={() => trackDemo('demo_cta', `tour-${step + 1}`)}
            className="mt-2 block text-center text-xs font-semibold text-[#2563EB] hover:underline">
            Já gostei — começar meu teste grátis →
          </a>
        )}
      </div>
    </div>
  )
}
