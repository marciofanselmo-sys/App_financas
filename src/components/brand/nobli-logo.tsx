import Image from 'next/image'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

interface NobliLogoProps {
  variant?: 'default' | 'compact' | 'light'
  className?: string
  showTagline?: boolean
}

/**
 * Marca NOBLI (símbolo orbital + wordmark + slogan).
 * O PNG é o ativo temporário aprovado no briefing — o SVG fiel é tarefa separada.
 * `scale-[1.12]` compensa a margem branca embutida no arquivo do símbolo.
 */
export function NobliLogo({ variant = 'default', className, showTagline = true }: NobliLogoProps) {
  const isLight = variant === 'light'
  const isCompact = variant === 'compact'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'relative shrink-0 overflow-hidden',
          isCompact ? 'h-8 w-8 rounded-[10px]' : 'h-9 w-9 rounded-xl',
          isLight && 'ring-1 ring-white/25 shadow-lg shadow-black/20',
        )}
      >
        <Image
          src="/nobli/logo-icon.png"
          alt={BRAND.name}
          fill
          className="object-cover scale-[1.12]"
          sizes={isCompact ? '32px' : '36px'}
          priority
        />
      </div>
      <div className="min-w-0">
        <span
          className={cn(
            'block font-heading font-extrabold leading-none tracking-[0.02em]',
            isCompact ? 'text-[15px]' : 'text-[17px]',
            isLight ? 'text-white' : 'text-[#0B2D6B] dark:text-white',
          )}
        >
          {BRAND.name}
        </span>
        {showTagline && !isCompact && (
          <span
            className={cn(
              'block text-[10px] leading-tight mt-1 truncate',
              isLight ? 'text-blue-100/90' : 'text-[#5B6B84] dark:text-slate-400',
            )}
          >
            {BRAND.tagline}
          </span>
        )}
      </div>
    </div>
  )
}
