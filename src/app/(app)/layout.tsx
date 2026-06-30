'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { usePageTracker } from '@/hooks/use-page-tracker'

function LayoutInner({ children }: { children: React.ReactNode }) {
  usePageTracker()
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0d1424]">
      <div className="hidden md:block sticky top-0 h-screen shrink-0 print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-w-0">
        {children}
      </main>
      <div className="print:hidden">
        <MobileNav />
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <LayoutInner>{children}</LayoutInner>
}
