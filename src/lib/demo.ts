/**
 * Demonstração ao vivo: o app de verdade, na conta da família Almeida Souza
 * (dados de exemplo), só para ver. Quem entra pelo "Ver demonstração" ganha
 * a sessão dessa conta e o cookie abaixo, que liga a faixa do topo, o tour e
 * o bloqueio de gravação na tela.
 *
 * O bloqueio de verdade é no banco (políticas restritivas para o usuário da
 * demo — migration_demo.sql). O da tela só evita o erro e mostra o convite.
 */
export const DEMO_COOKIE = 'nobli_demo'
export const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? 'demo@noblifinance.com.br'

export function isDemoClient(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some(c => c === `${DEMO_COOKIE}=1`)
}

export function clearDemoCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0`
}

// ── Gravação bloqueada → convite ────────────────────────────────────────────
// Só abre o convite quando a gravação veio de um clique/tecla da pessoa:
// gravações automáticas da tela (contadores, conciliações) falham caladas.
let lastInteraction = 0
if (typeof window !== 'undefined') {
  const mark = () => { lastInteraction = Date.now() }
  window.addEventListener('pointerdown', mark, true)
  window.addEventListener('keydown', mark, true)
}

export const DEMO_BLOCKED_EVENT = 'nobli-demo-bloqueado'

export function emitDemoBlocked(what: string) {
  if (typeof window === 'undefined') return
  if (Date.now() - lastInteraction > 4000) return
  window.dispatchEvent(new CustomEvent(DEMO_BLOCKED_EVENT, { detail: what }))
}

/** Marco da demonstração (Admin): vai pelo servidor, a conta da demo não grava. */
export function trackDemo(event: 'demo_tour' | 'demo_cta' | 'demo_bloqueio', key = '') {
  if (typeof window === 'undefined') return
  const id = `${event}|${key}`
  const w = window as unknown as { __demoSent?: Set<string> }
  w.__demoSent ??= new Set()
  if (w.__demoSent.has(id)) return
  w.__demoSent.add(id)
  void fetch('/api/demo/evento', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, key }),
  }).catch(() => {})
}

/** Tour: qual aba de Relatórios abrir (lida ao montar a tela e por evento). */
export const TOUR_REPORT_TAB = 'nobli_tour_aba_relatorio'
export const TOUR_REPORT_EVENT = 'nobli-tour-aba-relatorio'
