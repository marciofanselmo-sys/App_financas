'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'

export function usePageTracker() {
  const pathname = usePathname()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    // Evita registrar a mesma página duas vezes seguidas
    if (pathname === lastTracked.current) return
    lastTracked.current = pathname

    async function track() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return

      // Não bloqueia a navegação, mas precisa do .then(): no supabase-js a
      // consulta só é enviada quando alguém espera o resultado. Sem ele, o
      // insert nunca saía do navegador e o painel admin ficava sempre zerado.
      supabase.from('admin_page_views').insert({
        user_id:    user.id,
        user_email: user.email,
        page:       pathname,
      }).then(({ error }) => {
        if (error) logSafeError('pageTracker.insert', error)
      })
    }
    track()
  }, [pathname])
}
