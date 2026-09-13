import Image from 'next/image'
import { Shield, type LucideIcon } from 'lucide-react'
import { NobliLogo } from '@/components/brand/nobli-logo'

interface AuthBrandPanelProps {
  features: { icon: LucideIcon; text: string }[]
}

/**
 * Painel institucional das telas de auth — usa a foto orbital aprovada
 * (REF 01) sob um véu deep blue, com o hero oficial da marca.
 * A linguagem orbital fica restrita a este momento institucional,
 * conforme o briefing ("não como ornamento constante em telas densas").
 */
export function AuthBrandPanel({ features }: AuthBrandPanelProps) {
  return (
    <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
      {/* Foto orbital + véu deep blue */}
      <Image
        src="/nobli/login-hero.jpg"
        alt=""
        fill
        className="object-cover object-[70%_20%]"
        sizes="52vw"
        priority
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#081F4D]/95 via-[#0B2D6B]/88 to-[#1D4ED8]/70"
        aria-hidden
      />
      {/* Linha orbital sutil */}
      <svg
        className="absolute -right-20 top-16 h-[380px] w-[380px] text-white/15 pointer-events-none"
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
      >
        <ellipse cx="100" cy="100" rx="92" ry="34" stroke="currentColor" strokeWidth="0.8" transform="rotate(-24 100 100)" />
        <circle cx="160" cy="70" r="3.5" fill="#93C5FD" />
      </svg>

      <div className="relative z-10">
        <NobliLogo variant="light" showTagline />
      </div>

      <div className="relative z-10 space-y-9 max-w-md">
        <div className="space-y-5">
          <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/90">
            <span className="h-px w-8 bg-blue-300/60" aria-hidden />
            Planeje. Acompanhe. Conquiste.
          </p>

          <h1 className="font-heading text-[2.4rem] xl:text-[2.7rem] font-extrabold leading-[1.08] tracking-tight text-white">
            Mais que finanças.{' '}
            <span className="text-[#8FB6FF]">Um futuro em órbita com você.</span>
          </h1>

          <p className="text-blue-100/90 text-base leading-relaxed max-w-sm">
            Seu dinheiro. Sob controle. Organize, acompanhe e evolua com clareza — do dia a dia ao longo prazo.
          </p>
        </div>

        <div className="space-y-3">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm">
                <Icon className="h-4 w-4 text-blue-100" />
              </div>
              <span className="text-sm text-blue-50/95">{text}</span>
            </div>
          ))}
        </div>

        {/* Eco do produto — card patrimônio (linguagem da REF mobile) */}
        <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-md space-y-3 max-w-sm shadow-[var(--nobli-shadow-m)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/70">Patrimônio total</span>
            <span className="text-xs text-emerald-300 font-semibold">▲ 12,4% em 30 dias</span>
          </div>
          <p className="font-heading text-[1.7rem] font-bold text-white tabular-nums tracking-tight leading-none">
            R$ 24.830,56
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Em conta', val: 'R$ 4.250' },
              { label: 'Rendimento', val: 'R$ 2.430' },
              { label: 'Objetivos', val: '3 de 5' },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-xl bg-white/[0.08] border border-white/10 px-2.5 py-2">
                <p className="text-[9px] text-blue-200/70 mb-0.5">{label}</p>
                <p className="text-xs font-bold text-white tabular-nums">{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2 text-blue-200/70 text-xs">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        <span>Seus dados são privados, criptografados e protegidos</span>
      </div>
    </div>
  )
}
