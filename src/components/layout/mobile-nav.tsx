'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowLeftRight, LogOut, Settings, Target } from 'lucide-react'
import { ThemeToggleIcon } from '@/components/theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/settings/categories', label: 'Config.', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center z-50 md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            pathname === href || (href === '/settings/categories' && pathname.startsWith('/settings'))
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
      <ThemeToggleIcon />
      <button
        onClick={handleLogout}
        className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Sair
      </button>
    </nav>
  )
}
