'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, ArrowLeftRight, LogOut } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowLeftRight },
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center z-50 md:hidden">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
            pathname === href ? 'text-blue-600' : 'text-slate-500'
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
      <button
        onClick={handleLogout}
        className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Sair
      </button>
    </nav>
  )
}
