'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AppPageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

/**
 * Cabeçalho de página NOBLI.
 * No Dashboard vira a saudação da REF 01: "Olá, {nome}! Que bom te ver
 * por aqui. Seu futuro continua em movimento." Nas demais páginas,
 * título Jakarta navy + subtítulo cinza-azulado.
 */
export function AppPageHeader({ title, subtitle, actions }: AppPageHeaderProps) {
  const [greetingName, setGreetingName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? ''
      setGreetingName(name.split(' ')[0] || null)
    })
  }, [])

  const isGreeting = greetingName && title === 'Dashboard'

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-heading text-[1.6rem] sm:text-[1.8rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tracking-tight leading-tight">
          {isGreeting ? <>Olá, {greetingName}!</> : title}
        </h1>
        <p className="text-sm text-[#5B6B84] dark:text-slate-400 mt-1">
          {isGreeting
            ? 'Que bom te ver por aqui. Seu futuro continua em movimento.'
            : subtitle}
        </p>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}
