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
    pathname.startsWith('/auth') ||
    pathname.startsWith('/demo') ||
    pathname === '/privacy' ||
    pathname === '/terms'

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname.startsWith('/auth')) {
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
