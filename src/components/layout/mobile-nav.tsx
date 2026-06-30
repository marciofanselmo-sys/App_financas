'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, CalendarCheck, Target,
  MoreHorizontal, BarChart2, CreditCard, RefreshCw, FileText,
  Settings, LogOut, X, TrendingUp, HelpCircle, UserCircle,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

// Primary items always visible in the bottom bar
const PRIMARY = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Contas',         icon: ArrowLeftRight  },
  { href: '/planning',    label: 'Planejamento',   icon: CalendarCheck   },
  { href: '/goals',       label: 'Metas',          icon: Target          },
]

// Secondary items shown in the "Mais" drawer
const SECONDARY = [
  { href: '/analytics',   label: 'Análise',           icon: BarChart2    },
  { href: '/recurring',   label: 'Cartões & Parc.',   icon: CreditCard   },
  { href: '/fixos',       label: 'Recorrências',      icon: RefreshCw    },
  { href: '/reports',     label: 'Relatórios',        icon: FileText     },
  { href: '/settings/categories', label: 'Config.',   icon: Settings     },
  { href: '/account',     label: 'Minha conta',       icon: UserCircle   },
  { href: '/help',        label: 'Ajuda',             icon: HelpCircle   },
]

export function MobileNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isSecondaryActive = SECONDARY.some(s => pathname === s.href)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed left-0 right-0 z-50 md:hidden transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ bottom: '64px' }}
      >
        <div className="mx-3 mb-1 bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/[0.06] overflow-hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Menu</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Nav grid */}
          <div className="grid grid-cols-3 gap-0.5 p-3">
            {SECONDARY.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-[11px] font-medium transition-all',
                    active
                      ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'text-blue-600 dark:text-blue-400')} />
                  <span className="text-center leading-tight">{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Bottom row: theme + logout */}
          <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="flex-1">
              <ThemeToggle />
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-[#111c2d]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.06] flex items-center z-50 md:hidden">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 h-full text-[10px] font-semibold transition-colors relative',
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500" />
              )}
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}

        {/* Mais button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1 h-full text-[10px] font-semibold transition-colors relative',
            (open || isSecondaryActive)
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          )}
        >
          {(open || isSecondaryActive) && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500" />
          )}
          <div className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center transition-all',
            open
              ? 'bg-blue-600 text-white rotate-90 scale-110'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          )}>
            <MoreHorizontal className="h-4 w-4" />
          </div>
          Mais
        </button>
      </nav>
    </>
  )
}
