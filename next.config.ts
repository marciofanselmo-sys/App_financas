import type { NextConfig } from 'next'

const baseHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/**
 * Política de segurança do APLICATIVO — restritiva de propósito: é onde
 * estão os dados financeiros das pessoas. Nada de terceiros roda aqui.
 */
const securityHeaders = [
  ...baseHeaders,
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

/**
 * Política das páginas de MARKETING (landing e quiz), servidas do projeto do
 * time de aquisição.
 *
 * Elas carregam CSS, fontes e bibliotecas de CDN. Com a política do app, todo
 * o estilo era bloqueado e a página aparecia crua — foi o que aconteceu ao
 * ligar a landing no domínio. Aqui esses domínios são liberados um a um, e só
 * nestes caminhos: login, app, API e webhook continuam sob a política acima.
 *
 * `form-action` inclui a Cakto porque o botão de compra leva ao checkout.
 * Nenhum dado de cliente do app passa por estas páginas.
 */
const marketingHeaders = [
  ...baseHeaders,
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://pay.cakto.com.br",
    ].join('; '),
  },
]

/**
 * Página de vendas hospedada em OUTRO projeto (o do sócio de aquisição),
 * servida pelo mesmo domínio.
 *
 * `LP_ORIGIN` é a URL do projeto dele (ex.: https://nobli-lp.vercel.app).
 * Enquanto estiver vazia, nada muda: a landing atual do app continua
 * respondendo. Quando estiver preenchida, os caminhos de marketing passam a
 * vir do projeto dele, sem que ele precise de acesso a este repositório, às
 * variáveis de ambiente ou ao banco.
 *
 * Só os caminhos abaixo saem daqui. Login, app, API e webhook continuam
 * sendo servidos por este projeto.
 *
 * /obrigado também é do projeto dele desde 28/09/2026. A página deste repo
 * continua existindo e volta a responder sozinha se `LP_ORIGIN` ficar vazia —
 * é o que evita que o cliente pague e caia em uma página de erro caso o
 * projeto da landing saia do ar.
 */
const LP_ORIGIN = process.env.LP_ORIGIN?.replace(/\/$/, '')

const marketingRewrites = LP_ORIGIN
  ? [
      { source: '/', destination: `${LP_ORIGIN}/` },
      { source: '/lp/:path*', destination: `${LP_ORIGIN}/lp/:path*` },
      { source: '/quiz', destination: `${LP_ORIGIN}/quiz` },
      { source: '/quiz/:path*', destination: `${LP_ORIGIN}/quiz/:path*` },
      { source: '/landing-page', destination: `${LP_ORIGIN}/landing-page` },
      { source: '/landing-page/:path*', destination: `${LP_ORIGIN}/landing-page/:path*` },
      { source: '/obrigado', destination: `${LP_ORIGIN}/obrigado` },
      { source: '/obrigado/:path*', destination: `${LP_ORIGIN}/obrigado/:path*` },
      // Imagens e estáticos da landing. O app não usa /assets nem /_lp, então
      // não há colisão de caminho entre os dois projetos.
      { source: '/assets/:path*', destination: `${LP_ORIGIN}/assets/:path*` },
      { source: '/_lp/:path*', destination: `${LP_ORIGIN}/_lp/:path*` },
    ]
  : []

const nextConfig: NextConfig = {
  // /import era um atalho duplicado: pedia a conta e abria a mesma janela de
  // importação que já existe dentro de cada conta. Foi removido para deixar o
  // app mais limpo. Link antigo ou favorito cai em Contas e Cartões — onde a
  // importação mora — em vez de uma página de erro.
  async rewrites() {
    // beforeFiles: '/' existe neste projeto (a landing atual), então o
    // redirecionamento precisa acontecer ANTES de o Next resolver a rota.
    return { beforeFiles: marketingRewrites, afterFiles: [], fallback: [] }
  },
  async redirects() {
    return [
      { source: '/import', destination: '/transactions', permanent: false },
      // Categorias, Subcategorias e Categorias isoladas viraram uma tela só
      // (dois níveis + eventos). Link antigo cai nela.
      { source: '/categories', destination: '/settings/categories', permanent: false },
      { source: '/settings/isolated-categories', destination: '/settings/categories', permanent: false },
      { source: '/settings/subcategories', destination: '/settings/categories', permanent: false },
    ]
  },
  async headers() {
    // A regra mais específica vem depois: no Next, quando duas regras batem
    // no mesmo caminho, a última vence para o mesmo cabeçalho.
    const marketing = [
      '/',
      '/landing-page',
      '/landing-page/:path*',
      '/quiz',
      '/quiz/:path*',
      '/obrigado',
      '/obrigado/:path*',
      '/assets/:path*',
    ]
    return [
      { source: '/(.*)', headers: securityHeaders },
      ...marketing.map(source => ({ source, headers: marketingHeaders })),
    ]
  },
}

export default nextConfig
