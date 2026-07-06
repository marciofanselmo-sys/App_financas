'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type InfoBoxColor = 'blue' | 'violet'

const COLOR_CLASSES: Record<InfoBoxColor, string> = {
  blue:   'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  violet: 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50 text-violet-700 dark:text-violet-300',
}

interface InfoBoxProps {
  // Identificador único — usado pra lembrar se o usuário minimizou essa caixa
  // específica (persistido em localStorage, sobrevive entre visitas).
  id: string
  title?: string
  icon?: React.ElementType
  color?: InfoBoxColor
  defaultOpen?: boolean
  children: React.ReactNode
}

// Caixa explicativa ("Como funciona") colapsável — usada em telas com
// bastante lógica não óbvia. Minimizada, ela lembra a preferência do usuário
// pra não ocupar espaço da tela toda vez que ele voltar na página.
export function InfoBox({ id, title = 'Como funciona', icon: Icon = Info, color = 'blue', defaultOpen = true, children }: InfoBoxProps) {
  const storageKey = `infobox-open:${id}`
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) setOpen(stored === 'true')
  }, [storageKey])

  function toggle() {
    setOpen(prev => {
      const next = !prev
      localStorage.setItem(storageKey, String(next))
      return next
    })
  }

  return (
    <div className={cn('rounded-xl text-sm', COLOR_CLASSES[color])}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 p-4 text-left font-semibold"
      >
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {children}
        </div>
      )}
    </div>
  )
}
