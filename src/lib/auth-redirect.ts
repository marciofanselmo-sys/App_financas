/** URL base para links de confirmação/recuperação de senha (Supabase Auth). */
export function getAuthRedirectOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export function getAuthCallbackUrl(path = '/auth/login'): string {
  const origin = getAuthRedirectOrigin()
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
