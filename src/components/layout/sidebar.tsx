'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { BoardIcon } from '@/components/transactions/board-icon'
import {
  LayoutDashboard, ArrowLeftRight, LogOut, TrendingUp, Settings,
  Tag, ChevronDown, Target, RefreshCw, BarChart2, CalendarCheck,
  Zap, CreditCard, FileText, HelpCircle, ChevronRight, Layers, Shield,
  PiggyBank, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

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
  { href: '/settings/subcategories',       label: 'Subcategorias',       icon: Layers   },
  { href: '/settings/isolated-categories', label: 'Categorias isoladas', icon: Sparkles },
  { href: '/settings/rules',               label: 'Regras auto.',        icon: Zap      },
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
          ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600 dark:text-blue-400' : '')} />
      <span className="flex-1">{label}</span>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0" />}
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
            ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
        )}
      >
        <Link href={href} className="flex-1 flex items-center gap-3 px-3 py-2 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-blue-600 dark:text-blue-400' : '')} />
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
    <aside className="w-64 h-screen bg-white dark:bg-[#111c2d] border-r border-slate-200/80 dark:border-white/[0.06] flex flex-col">

      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">FinanceApp</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5">Gestão Financeira</p>
          </div>
        </div>
      </div>

      {/* Perfil do usuário */}
      <Link
        href="/account"
        className={cn(
          'mx-3 mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group border shrink-0',
          pathname === '/account'
            ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-200 dark:hover:border-white/10'
        )}
      >
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', pathname === '/account' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200')}>
            {displayName}
          </p>
          {userEmail && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{userEmail}</p>
          )}
        </div>
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-colors', pathname === '/account' ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400')} />
      </Link>

      {/* Nav principal */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 mb-1">
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
                              ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                              : 'text-slate-500 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-300'
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

        {/* Ajuda — antes do separador */}
        <NavItem
          href="/help"
          label="Ajuda"
          icon={HelpCircle}
          active={pathname === '/help'}
        />

        {/* Link Admin — só visível para o dono do SaaS */}
        {userEmail === (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '') && (
          <NavItem
            href="/admin"
            label="Admin"
            icon={Shield}
            active={pathname === '/admin'}
          />
        )}
      </nav>

      {/* Rodapé: Configurações + Tema + Sair */}
      <div className="px-3 pb-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-0.5 shrink-0">
        {/* Configurações expansível */}
        <button
          onClick={() => setSettingsOpen(o => !o)}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 w-full',
            isInSettings
              ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <Settings className={cn('h-4 w-4 shrink-0', isInSettings ? 'text-blue-600 dark:text-blue-400' : '')} />
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
                    ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-300'
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
      </div>
    </aside>
  )
}
