'use client'

import { useCallback, useEffect, useState } from 'react'

/** Avisa o menu e o painel que a caixa mudou (abriu ou marcou como não lido). */
export const INBOX_EVENTO = 'nobli:inbox-mudou'

/**
 * Quantos e-mails não lidos há na caixa do NOBLI. Só busca para admin.
 * Atualiza ao abrir, a cada 2 minutos, ao voltar para a aba do navegador e
 * quando o painel avisa que algo mudou.
 */
export function useInboxUnread(enabled: boolean) {
  const [naoLidos, setNaoLidos] = useState(0)

  const buscar = useCallback(async (agora = false) => {
    try {
      const res = await fetch(`/api/admin/inbox/count${agora ? '?agora' : ''}`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      setNaoLidos(Number(body.naoLidos) || 0)
    } catch { /* sem rede: mantém o último número */ }
  }, [])

  useEffect(() => {
    if (!enabled) return
    buscar()
    const id = setInterval(() => buscar(), 120_000)
    const aoVoltar = () => { if (document.visibilityState === 'visible') buscar() }
    const aoMudar = () => buscar(true)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener(INBOX_EVENTO, aoMudar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener(INBOX_EVENTO, aoMudar)
    }
  }, [enabled, buscar])

  return naoLidos
}
