'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlan } from '@/hooks/use-subscription'

/**
 * Quantas importações de extrato o plano ainda permite neste mês.
 *
 * O contador vive no servidor (rota /api/plan/usage). O que está aqui é só
 * a leitura para a tela decidir o que mostrar.
 */
export function useImportQuota() {
  const { plan, loading: planLoading } = usePlan()
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/plan/usage?feature=import')
      if (res.ok) {
        const data = await res.json()
        setUsed(Number(data.count) || 0)
      }
    } catch {
      // Sem rede, não bloqueia ninguém: o limite é de cortesia, não de segurança.
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const limit = plan.importsPerMonth
  const blocked = limit !== null && used >= limit

  /** Chamar depois de uma importação que deu certo. */
  const record = useCallback(async () => {
    setUsed(u => u + 1)
    try {
      await fetch('/api/plan/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'import' }),
      })
    } catch {
      /* contador é melhor-esforço */
    }
  }, [])

  return { used, limit, blocked, record, loading: loading || planLoading, refetch: load }
}
