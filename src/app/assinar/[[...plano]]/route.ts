import { NextRequest, NextResponse } from 'next/server'

/**
 * Links curtos de assinatura no nosso domínio.
 *
 *   noblifinance.com.br/assinar/mensal       → checkout do plano Mensal
 *   noblifinance.com.br/assinar/trimestral   → checkout do plano Trimestral
 *   noblifinance.com.br/assinar/anual        → checkout do plano Anual
 *   noblifinance.com.br/assinar              → Mensal (padrão)
 *
 * Os links dos planos antigos (essencial, completo, *-anual) ainda circulam
 * em anúncio já publicado: caem no plano novo do mesmo período.
 *
 * Por que redirecionar e não repassar a página de pagamento: o checkout tem
 * antifraude, autenticação do cartão pelo banco (3DS) e cookies próprios da
 * Cakto. Servir aquilo pelo nosso domínio quebra esse conjunto e coloca sobre
 * nós uma responsabilidade sobre dado de cartão que hoje é inteiramente deles.
 *
 * O que isso resolve:
 *  - anúncio e landing usam um link da marca, não um código solto;
 *  - se a oferta mudar de id na Cakto, muda só a variável de ambiente — os
 *    anúncios já publicados continuam funcionando;
 *  - tudo que vier na URL (utm_source, utm_campaign, sck, callback) é
 *    repassado ao checkout, então a atribuição não se perde no caminho.
 */

const DESTINOS: Record<string, string | undefined> = {
  'mensal': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_MENSAL,
  'trimestral': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_TRIMESTRAL,
  'anual': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_ANUAL,
}

const LEGADO: Record<string, string> = {
  'essencial': 'mensal',
  'completo': 'mensal',
  'essencial-anual': 'anual',
  'completo-anual': 'anual',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plano?: string[] }> },
) {
  const { plano } = await params
  const pedido = (plano?.[0] ?? 'mensal').toLowerCase()
  const chave = LEGADO[pedido] ?? pedido

  const destino = DESTINOS[chave] ?? DESTINOS['mensal']
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

  // Sem checkout configurado, manda para a página de planos em vez de dar
  // erro: pior que um link errado é um link morto no meio de um anúncio.
  if (!destino) return NextResponse.redirect(`${site}/#planos`)

  const url = new URL(destino)
  // Repassa o que veio na URL (utm_*, sck, callback), sem sobrescrever o que
  // já faz parte do link do checkout.
  req.nextUrl.searchParams.forEach((valor, nome) => {
    if (!url.searchParams.has(nome)) url.searchParams.set(nome, valor)
  })

  // 302: o destino pode mudar (troca de oferta, promoção), então não deve
  // ficar guardado em cache no navegador de quem já clicou uma vez.
  return NextResponse.redirect(url.toString(), 302)
}
