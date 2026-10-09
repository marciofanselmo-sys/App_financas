import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicRoute =
    // Página do produto: é para onde os anúncios apontam. Quando a landing
    // externa estiver ligada (LP_ORIGIN), estes caminhos são servidos pelo
    // projeto do time de aquisição, mas continuam sendo públicos aqui.
    pathname === '/' ||
    pathname.startsWith('/lp') ||
    pathname.startsWith('/quiz') ||
    pathname.startsWith('/landing-page') ||
    pathname.startsWith('/assets') ||
    // Links curtos de assinatura: quem vem do anúncio não tem sessão.
    pathname.startsWith('/assinar') ||
    // Porta do teste grátis de 7 dias (leva ao cadastro).
    pathname === '/teste' ||
    // Descadastro dos e-mails de oferta: quem clica pode nem ter conta.
    pathname === '/sair' ||
    pathname.startsWith('/api/email/sair') ||
    // Páginas de marketing servidas pelo projeto de aquisição.
    pathname.startsWith('/lp') ||
    pathname.startsWith('/quiz') ||
    // Retorno do checkout: quem comprou pelo anúncio ainda não tem sessão.
    pathname === '/obrigado' ||
    pathname === '/primeiro-acesso' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/demo') ||
    // Webhook de pagamento: quem chama é a Cakto, que não tem sessão. A
    // autenticação dele é a assinatura HMAC da própria entrega.
    pathname.startsWith('/api/webhooks') ||
    // Cron da Vercel (e-mails do teste): autenticado pelo CRON_SECRET.
    pathname.startsWith('/api/cron') ||
    // Pedido de novo link de acesso: quem precisa dele é, por definição, quem
    // não consegue entrar.
    pathname.startsWith('/api/auth') ||
    // Diagnóstico de configuração: responde só com estado, nunca com segredo.
    pathname.startsWith('/api/diagnostico') ||
    pathname === '/privacy' ||
    pathname === '/terms'

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Quem já está logado não precisa ver página de vendas na raiz — e esse
  // desvio acontece antes do repasse para a landing externa.
  if (user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Exceção: /auth/confirm é o botão do e-mail de acesso. Com o navegador já
  // logado, desviar para o dashboard pulava a tela de criar senha — o link
  // precisa sempre trocar a sessão e abrir /primeiro-acesso.
  if (user && pathname.startsWith('/auth') && pathname !== '/auth/confirm') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith('/admin')) {
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_app_admin')
    // Falha da RPC (função ausente no banco, erro de rede) cai no mesmo caminho
    // de "não é admin" — fail-closed está certo, mas sem log o dono do produto
    // perde o acesso ao painel e não tem como descobrir por quê. (14.34)
    if (adminError) {
      console.error('[middleware] is_app_admin falhou:', adminError.message, '| code:', adminError.code)
    }
    if (!isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

// Arquivos estáticos NUNCA podem passar por aqui. A lista antiga só excluía
// imagens, então o worker do pdf.js (`/pdf.worker.min.mjs`) e os ícones em
// subpastas (`/nobli/favicon.ico`) eram redirecionados para /auth/login: o
// pdf.js pedia o worker, recebia HTML e a importação de PDF quebrava com
// "Erro ao processar o PDF".
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mjs|js|css|json|txt|xml|map|woff|woff2|ttf|otf|eot|wasm|pdf)$).*)',
  ],
}
