import { NextRequest, NextResponse } from 'next/server'

/**
 * Links curtos de assinatura no nosso domínio.
 *
 *   noblifinance.com.br/assinar/essencial        → checkout Essencial mensal
 *   noblifinance.com.br/assinar/essencial-anual  → checkout Essencial anual
 *   noblifinance.com.br/assinar/completo         → checkout Completo mensal
 *   noblifinance.com.br/assinar/completo-anual   → checkout Completo anual
 *   noblifinance.com.br/assinar                  → Completo mensal (padrão)
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
  'essencial': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_ESSENCIAL_MENSAL,
  'essencial-anual': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_ESSENCIAL_ANUAL,
  'completo': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_COMPLETO_MENSAL,
  'completo-anual': process.env.NEXT_PUBLIC_CAKTO_CHECKOUT_COMPLETO_ANUAL,
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ plano?: string[] }> },
) {
  const { plano } = await params
  const chave = (plano?.[0] ?? 'completo').toLowerCase()

  const destino = DESTINOS[chave] ?? DESTINOS['completo']
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
