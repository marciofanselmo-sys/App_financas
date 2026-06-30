'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

      // fire-and-forget — não bloqueia, não impacta performance
      supabase.from('admin_page_views').insert({
        user_id:    user.id,
        user_email: user.email,
        page:       pathname,
      })
    }
    track()
  }, [pathname])
}
