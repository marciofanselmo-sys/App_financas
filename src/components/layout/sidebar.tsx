'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { BoardIcon } from '@/components/transactions/board-icon'
import {
  LayoutDashboard, ArrowLeftRight, LogOut, Settings,
  Tag, ChevronDown, Target, RefreshCw, BarChart2, CalendarCheck,
  Zap, CreditCard, FileText, HelpCircle, ChevronRight, Shield,
  PiggyBank, MessageSquarePlus, ArrowUpRight, Crown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { BRAND } from '@/lib/brand'

// ── Grupos de navegação ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Visão Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/analytics', label: 'Análise',   icon: BarChart2       },
      { href: '/reports',   label: 'Relatórios', icon: FileText        },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/transactions', label: 'Contas e Cartões', icon: ArrowLeftRight },
      { href: '/investments',  label: 'Investimentos',    icon: PiggyBank      },
      { href: '/planning',     label: 'Planejamento',     icon: CalendarCheck  },
      { href: '/goals',        label: 'Metas',            icon: Target         },
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

const SETTINGS_ITEMS = [
  { href: '/settings/categories',          label: 'Categorias',          icon: Tag      },
  { href: '/settings/rules',               label: 'Regras auto.',        icon: Zap      },
  { href: '/settings/assinatura',          label: 'Minha assinatura',    icon: Crown    },
]

// ── Componente de item de nav ──────────────────────────────────────────────────
function NavItem({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: React.ElementType; active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
        active
          ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300 shadow-sm shadow-[#2563EB]/5'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-200'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#2563EB] dark:text-blue-400' : '')} />
      <span className="flex-1">{label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] dark:bg-blue-400 shrink-0" />}
    </Link>
  )
}

// ── Item de nav expansível (Contas e Cartões → lista de contas) ────────────────
function NavItemExpandable({
  href, label, icon: Icon, active, open, onToggle, children,
}: {
  href: string; label: string; icon: React.ElementType; active: boolean
  open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div>
      <div
        className={cn(
          'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
          active
            ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-200'
        )}
      >
        <Link href={href} className="flex-1 flex items-center gap-3 px-3 py-2 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#2563EB] dark:text-blue-400' : '')} />
          <span className="flex-1 truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="pr-3 pl-1 py-2 shrink-0"
          aria-label={open ? 'Recolher contas' : 'Expandir contas'}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </div>
      {open && (
        <div className="pl-4 space-y-0.5 mt-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const isInSettings = pathname.startsWith('/settings')
  const [settingsOpen, setSettingsOpen] = useState(isInSettings)
  const [userEmail, setUserEmail] = useState('')
  const { isAdmin } = useIsAdmin()
  const [userName, setUserName]   = useState('')
  const { boards } = useTransactionBoards()

  // Contas de investimento têm sua própria aba — o board-detail continua
  // vivendo em /transactions/[boardId] pros dois casos (reuso da mesma tela),
  // então o "em qual aba estou" precisa saber a QUAL board aquele id pertence,
  // não só olhar o prefixo da URL.
  const investmentBoards = boards.filter(b => b.is_investment)
  const nonInvestmentBoards = boards.filter(b => !b.is_investment)
  const isInInvestmentBoard = investmentBoards.some(b => pathname === `/transactions/${b.id}`)
  const isInAccounts = (pathname === '/transactions' || pathname.startsWith('/transactions/')) && !isInInvestmentBoard
  const isInInvestments = pathname === '/investments' || isInInvestmentBoard
  const [accountsOpen, setAccountsOpen] = useState(isInAccounts)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
      setUserName(name)
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const displayName = userName || userEmail.split('@')[0] || 'Minha conta'
  const initials    = displayName.slice(0, 2).toUpperCase()

  return (
    <aside className="w-64 h-screen bg-white dark:bg-[#0D1B30] border-r border-[#DDE7F3] dark:border-white/[0.07] flex flex-col">

      {/* Logo */}
      <div className="px-5 py-5 shrink-0">
        <Link href="/dashboard">
          <NobliLogo />
        </Link>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-3 pb-4 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#93A5C1] dark:text-slate-500 px-3 mb-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => (
                item.href === '/transactions' ? (
                  <NavItemExpandable
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={isInAccounts}
                    open={accountsOpen}
                    onToggle={() => setAccountsOpen(o => !o)}
                  >
                    {nonInvestmentBoards.length === 0 ? (
                      <p className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">Nenhuma conta criada</p>
                    ) : (
                      nonInvestmentBoards.map(board => (
                        <Link
                          key={board.id}
                          href={`/transactions/${board.id}`}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 min-w-0',
                            pathname === `/transactions/${board.id}`
                              ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
                              : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-300'
                          )}
                        >
                          <BoardIcon icon={board.icon} className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{board.name}</span>
                        </Link>
                      ))
                    )}
                  </NavItemExpandable>
                ) : item.href === '/investments' ? (
                  <NavItem
                    key={item.href}
                    {...item}
                    active={isInInvestments}
                  />
                ) : (
                  <NavItem
                    key={item.href}
                    {...item}
                    active={pathname === item.href}
                  />
                )
              ))}
            </div>
          </div>
        ))}

        <NavItem
          href="/suggestions"
          label="Sugestões"
          icon={MessageSquarePlus}
          active={pathname === '/suggestions'}
        />

        {/* Ajuda — antes do separador */}
        <NavItem
          href="/help"
          label="Ajuda"
          icon={HelpCircle}
          active={pathname === '/help'}
        />

        {/* Link Admin — só visível para o dono do SaaS */}
        {isAdmin && (
          <NavItem
            href="/admin"
            label="Admin"
            icon={Shield}
            active={pathname === '/admin'}
          />
        )}

        {/* Promo NOBLI — foto orbital da REF 01 com véu deep blue.
            Só aparece quando a altura comporta o card inteiro (evita clip). */}
        <div className="relative mx-1 mt-2 overflow-hidden rounded-2xl shadow-[var(--nobli-shadow-s)] hidden [@media(min-height:960px)]:block">
          <Image
            src="/nobli/orbit-hero.jpg"
            alt=""
            fill
            className="object-cover object-[62%_30%]"
            sizes="220px"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B2D6B]/90 via-[#12377e]/75 to-[#2563EB]/55" aria-hidden />
          <div className="relative p-3.5">
            <p className="font-heading text-[13px] font-bold text-white leading-snug pr-4">
              {BRAND.promo}
            </p>
            <div className="mt-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm">
              <ArrowUpRight className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>
      </nav>

      {/* Rodapé: Configurações + Tema + Sair + Perfil */}
      <div className="px-3 pb-4 pt-3 border-t border-[#DDE7F3] dark:border-white/[0.07] space-y-0.5 shrink-0">
        {/* Configurações expansível */}
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 w-full',
            isInSettings
              ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-200'
          )}
        >
          <Settings className={cn('h-4 w-4 shrink-0', isInSettings ? 'text-[#2563EB] dark:text-blue-400' : '')} />
          <span className="flex-1 text-left">Configurações</span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', settingsOpen && 'rotate-180')} />
        </button>

        {settingsOpen && (
          <div className="pl-4 space-y-0.5">
            {SETTINGS_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                  pathname === href
                    ? 'bg-[#E8F2FF] dark:bg-blue-500/15 text-[#2563EB] dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0B2D6B] dark:hover:text-slate-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        )}

        <div className="pt-1">
          <ThemeToggle />
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-slate-500 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>

        <Link
          href="/account"
          className={cn(
            'mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group border',
            pathname === '/account'
              ? 'bg-[#E8F2FF] dark:bg-blue-500/15 border-[#2563EB]/20 dark:border-blue-500/20'
              : 'bg-[#F5F9FE] dark:bg-white/[0.03] border-[#DDE7F3] dark:border-white/[0.06] hover:bg-[#E8F2FF]/70 dark:hover:bg-white/[0.06]'
          )}
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#0B2D6B] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-[#2563EB]/25">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold truncate', pathname === '/account' ? 'text-[#2563EB] dark:text-blue-300' : 'text-[#0B2D6B] dark:text-slate-200')}>
              {displayName}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {userEmail || 'Ver meu perfil'}
            </p>
          </div>
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0', pathname === '/account' ? 'text-[#2563EB]' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400')} />
        </Link>
      </div>
    </aside>
  )
}
