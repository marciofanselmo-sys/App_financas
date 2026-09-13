import { NobliLogo } from '@/components/brand/nobli-logo'
import { ThemeToggle } from '@/components/theme-toggle'

interface AuthFormShellProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthFormShell({ children, footer }: AuthFormShellProps) {
  return (
    <div className="flex flex-1 flex-col min-h-screen bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between px-6 py-4 lg:px-10 border-b border-slate-100/80 dark:border-white/[0.06] lg:border-none">
        <div className="lg:hidden">
          <NobliLogo variant="compact" showTagline={false} />
        </div>
        <div className="hidden lg:block" />
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-8 lg:px-16">
        <div className="w-full max-w-sm space-y-6">{children}</div>
      </div>

      {footer && (
        <div className="px-6 py-4 lg:px-10 text-center border-t border-slate-100/80 dark:border-white/[0.06]">
          {footer}
        </div>
      )}
    </div>
  )
}
