import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: React.ElementType
  iconColor?: string
  iconBg?: string
  title: string
  description: string
  primaryLabel: string
  primaryHref?: string
  primaryOnClick?: () => void
  secondaryLabel?: string
  secondaryHref?: string
  preview?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  iconColor = 'text-blue-500',
  iconBg = 'bg-blue-50 dark:bg-blue-900/30',
  title,
  description,
  primaryLabel,
  primaryHref,
  primaryOnClick,
  secondaryLabel,
  secondaryHref,
  preview,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center max-w-sm mx-auto">
      <div className={`h-16 w-16 rounded-2xl ${iconBg} flex items-center justify-center`}>
        <Icon className={`h-8 w-8 ${iconColor}`} />
      </div>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{title}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        {primaryHref ? (
          <Link href={primaryHref} className="flex-1">
            <Button className="w-full">{primaryLabel}</Button>
          </Link>
        ) : (
          <Button className="flex-1" onClick={primaryOnClick}>{primaryLabel}</Button>
        )}
        {secondaryLabel && secondaryHref && (
          <Link href={secondaryHref} className="flex-1">
            <Button variant="outline" className="w-full">{secondaryLabel}</Button>
          </Link>
        )}
      </div>
      {preview && (
        <div className="w-full mt-2 opacity-40 pointer-events-none select-none" aria-hidden>
          {preview}
        </div>
      )}
    </div>
  )
}
