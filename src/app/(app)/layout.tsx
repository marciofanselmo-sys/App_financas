import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="hidden md:block sticky top-0 h-screen shrink-0">
        <Sidebar />
      </div>
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 min-w-0">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}
