import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
 * sendo servidos por este projeto — inclusive /obrigado, que depende de
 * saber se a pessoa está logada.
 */
const LP_ORIGIN = process.env.LP_ORIGIN?.replace(/\/$/, '')

const marketingRewrites = LP_ORIGIN
  ? [
      { source: '/', destination: `${LP_ORIGIN}/` },
      { source: '/lp/:path*', destination: `${LP_ORIGIN}/lp/:path*` },
      { source: '/quiz/:path*', destination: `${LP_ORIGIN}/quiz/:path*` },
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
  /**
   * Página de vendas hospedada por fora, no mesmo domínio.
   *
   * O time de aquisição publica no projeto Vercel dele; aqui o app só
   * repassa os caminhos de marketing para lá. Para quem visita, é um site
   * só em noblifinance.com.br — e eles publicam quando quiserem, sem tocar
   * no código do produto, no banco ou nas chaves.
   *
   * Com LP_ORIGIN vazio, nada muda: continua valendo a página que está
   * dentro do app. É o interruptor que liga a landing externa.
   */
  async rewrites() {
    const lp = process.env.LP_ORIGIN?.replace(/\/$/, '')
    if (!lp) return []
    return [
      { source: '/', destination: `${lp}/` },
      { source: '/lp/:path*', destination: `${lp}/lp/:path*` },
      { source: '/quiz/:path*', destination: `${lp}/quiz/:path*` },
      // Arquivos estáticos da landing (imagens, css, js do build dela).
      { source: '/_lp/:path*', destination: `${lp}/_lp/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
