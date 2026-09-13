'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.rpc('is_app_admin')
    setIsAdmin(!error && data === true)
    setLoading(false)
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return { isAdmin, loading, refetch: check }
}
