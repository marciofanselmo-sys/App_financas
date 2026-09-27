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
      { source: '/quiz', destination: `${LP_ORIGIN}/quiz` },
      { source: '/quiz/:path*', destination: `${LP_ORIGIN}/quiz/:path*` },
      { source: '/landing-page', destination: `${LP_ORIGIN}/landing-page` },
      { source: '/landing-page/:path*', destination: `${LP_ORIGIN}/landing-page/:path*` },
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
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
