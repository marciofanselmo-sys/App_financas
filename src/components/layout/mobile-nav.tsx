'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, CalendarCheck, Target,
  MoreHorizontal, BarChart2, CreditCard, RefreshCw, FileText,
  LogOut, X, HelpCircle, PiggyBank, MessageSquarePlus,
  Tag, Zap, Crown, Shield, Settings, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { ThemeToggle } from '@/components/theme-toggle'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { usePlan } from '@/hooks/use-subscription'
import { ROUTE_FEATURE } from '@/lib/plans'

// Primary items always visible in the bottom bar
const PRIMARY = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/transactions', label: 'Contas',         icon: ArrowLeftRight  },
  { href: '/planning',    label: 'Planejamento',   icon: CalendarCheck   },
  { href: '/analytics',   label: 'Análise',        icon: BarChart2       },
]

// Menu "Mais": o mesmo formato do menu do computador (lista com seções),
// só com o que não está na barra de baixo.
type NavLink = { href: string; label: string; icon: React.ElementType }
const SECTIONS: { label: string; items: NavLink[] }[] = [
  { label: 'Visão geral',    items: [{ href: '/reports', label: 'Relatórios', icon: FileText }] },
  {
    label: 'Gestão',
    items: [
      { href: '/investments', label: 'Investimentos', icon: PiggyBank },
      { href: '/goals',       label: 'Metas',         icon: Target    },
    ],
  },
  {
    label: 'Acompanhamento',
    items: [
      { href: '/recurring', label: 'Cartões & Parcelas', icon: CreditCard },
      { href: '/fixos',     label: 'Recorrências',       icon: RefreshCw  },
    ],
  },
]
const EXTRA: NavLink[] = [
  { href: '/suggestions', label: 'Sugestões', icon: MessageSquarePlus },
  { href: '/help',        label: 'Ajuda',     icon: HelpCircle        },
]
const SETTINGS_ITEMS: NavLink[] = [
  { href: '/settings/categories', label: 'Categorias',       icon: Tag   },
  { href: '/settings/rules',      label: 'Regras auto.',     icon: Zap   },
  { href: '/settings/assinatura', label: 'Minha assinatura', icon: Crown },
]
const SECONDARY_HREFS = [...SECTIONS.flatMap(s => s.items), ...EXTRA, ...SETTINGS_ITEMS].map(i => i.href)

function DrawerItem({ href, label, icon: Icon, active, locked, small }: NavLink & { active: boolean; locked: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
        active
          ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
          : locked
            ? 'text-slate-400 dark:text-slate-600'
            : small
              ? 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-100',
      )}
    >
      <Icon className={cn(small ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0', active && 'text-[#2563EB] dark:text-blue-400')} />
      <span className="flex-1">{label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] dark:bg-blue-400 shrink-0" />}
    </Link>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)
  const { isAdmin } = useIsAdmin()
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings'))
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      setUserName(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '')
    })
  }, [])
  const displayName = userName || userEmail.split('@')[0] || 'Minha conta'
  const initials = displayName.slice(0, 2).toUpperCase()
  // Tela fora do plano: continua clicável (abre a explicação do plano), só
  // com a letra mais fraca. Enquanto o plano carrega, nada fica apagado.
  const { can, loading: planLoading } = usePlan()
  const isLocked = (href: string) => {
    const f = ROUTE_FEATURE[href]
    return !!f && !planLoading && !can(f)
  }

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const isSecondaryActive = SECONDARY_HREFS.includes(pathname) || pathname === '/admin' || pathname === '/account'
  const extra = isAdmin ? [...EXTRA, { href: '/admin', label: 'Admin', icon: Shield }] : EXTRA
  const inSettings = pathname.startsWith('/settings')

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
        <div className="mx-3 mb-1 bg-white dark:bg-[#101F36] rounded-2xl shadow-2xl border border-[#DDE7F3] dark:border-white/[0.08] overflow-hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
            <NobliLogo variant="compact" showTagline={false} />
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Lista no formato do menu do computador — rola quando a tela é baixa */}
          <div className="max-h-[calc(100dvh-64px-72px)] overflow-y-auto">
            <nav className="px-3 pt-3 pb-2 space-y-4">
              {SECTIONS.map(section => (
                <div key={section.label}>
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map(item => (
                      <DrawerItem key={item.href} {...item} active={pathname === item.href} locked={isLocked(item.href)} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="space-y-0.5">
                {extra.map(item => (
                  <DrawerItem key={item.href} {...item} active={pathname === item.href} locked={false} />
                ))}
              </div>
            </nav>

            {/* Rodapé: Configurações, tema, sair e perfil — como no computador */}
            <div className="px-3 pt-3 pb-3 border-t border-slate-100 dark:border-white/[0.06] space-y-0.5">
              <button
                type="button"
                onClick={() => setSettingsOpen(o => !o)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  inSettings
                    ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Configurações</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', settingsOpen && 'rotate-180')} />
              </button>
              {settingsOpen && (
                <div className="pl-4 space-y-0.5">
                  {SETTINGS_ITEMS.map(item => (
                    <DrawerItem key={item.href} {...item} small active={pathname === item.href} locked={isLocked(item.href)} />
                  ))}
                </div>
              )}

              <div className="pt-1">
                <ThemeToggle />
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>

              <Link
                href="/account"
                className={cn(
                  'mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                  pathname === '/account'
                    ? 'bg-[#E8F2FF] dark:bg-blue-500/15 border-[#2563EB]/20 dark:border-blue-500/20'
                    : 'bg-[#F5F9FE] dark:bg-white/[0.03] border-[#DDE7F3] dark:border-white/[0.06]',
                )}
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0B2D6B] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-[#0B2D6B] dark:text-slate-200">{displayName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{userEmail || 'Ver meu perfil'}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#101F36]/90 backdrop-blur-xl border-t border-[#DDE7F3] dark:border-white/[0.08] flex items-center z-50 md:hidden">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 h-full text-[10px] font-semibold transition-colors relative',
                active
                  ? 'text-[#2563EB] dark:text-blue-400'
                  : isLocked(href)
                    ? 'text-slate-300 dark:text-slate-600'
                    : 'text-slate-400 dark:text-slate-500 hover:text-[#0B2D6B] dark:hover:text-slate-300'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#2563EB]" />
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
              ? 'text-[#2563EB] dark:text-blue-400'
              : 'text-slate-400 dark:text-slate-500 hover:text-[#0B2D6B] dark:hover:text-slate-300'
          )}
        >
          {(open || isSecondaryActive) && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#2563EB]" />
          )}
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-md shadow-[#2563EB]/25',
            open
              ? 'nobli-gradient text-white rotate-90 scale-110'
              : 'nobli-gradient text-white'
          )}>
            <MoreHorizontal className="h-4 w-4" />
          </div>
          Mais
        </button>
      </nav>
    </>
  )
}
