'use client'

import { useEffect, useState } from 'react'

/**
 * Aberto/fechado de um bloco recolhível, lembrado neste navegador.
 * Começa em `initial` e só lê a escolha salva depois de montar, para o
 * HTML do servidor e o do navegador baterem.
 */
export function usePersistedToggle(key: string, initial = true): [boolean, () => void] {
  const storageKey = `nobli:${key}`
  const [open, setOpen] = useState(initial)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) setOpen(saved === '1')
    } catch {}
  }, [storageKey])

  function toggle() {
    setOpen(v => {
      try { localStorage.setItem(storageKey, v ? '0' : '1') } catch {}
      return !v
    })
  }

  return [open, toggle]
}
