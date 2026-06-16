'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-9 w-9" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-full"
      aria-label="Alternar tema"
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-yellow-500" />
          <span>Modo claro</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-slate-500" />
          <span>Modo escuro</span>
        </>
      )}
    </button>
  )
}

export function ThemeToggleIcon() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-5 w-5" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
      aria-label="Alternar tema"
    >
      {isDark ? (
        <>
          <Sun className="h-5 w-5 text-yellow-500" />
          <span>Tema</span>
        </>
      ) : (
        <>
          <Moon className="h-5 w-5" />
          <span>Tema</span>
        </>
      )}
    </button>
  )
}
