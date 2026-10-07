'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { ErrorListener } from '@/components/error-listener'
import { MobileNav } from '@/components/layout/mobile-nav'
import { EmailConfirmBanner } from '@/components/auth/email-confirm-banner'
import { usePageTracker } from '@/hooks/use-page-tracker'
import { TrialClock } from '@/components/trial/trial-clock'
import { TrialToasts } from '@/components/trial/trial-toasts'
import { useTrialJourneySync } from '@/hooks/use-trial-journey'
import { useSubscription } from '@/hooks/use-subscription'

function LayoutInner({ children }: { children: React.ReactNode }) {
  usePageTracker()
  const { inTrial } = useSubscription()
  useTrialJourneySync(inTrial)
  return (
    <div className="flex min-h-screen bg-background">
      <ErrorListener />
      <div className="hidden md:block sticky top-0 h-screen shrink-0 print:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 min-w-0">
        <EmailConfirmBanner />
        <TrialClock />
        {inTrial && <TrialToasts />}
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
