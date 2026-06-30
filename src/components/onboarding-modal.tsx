'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ArrowRight, CheckCircle, BarChart2, CalendarCheck, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'financeapp_onboarding_done'

const STEPS = [
  {
    icon: TrendingUp,
    color: 'bg-blue-600',
    title: 'Bem-vindo ao FinanceApp!',
    body: 'Você está a um passo de ter total controle sobre suas finanças. Vamos configurar tudo em menos de 2 minutos.',
    cta: 'Começar',
  },
  {
    icon: ArrowRight,
    color: 'bg-emerald-500',
    title: 'Registre suas movimentações',
    body: 'Adicione suas receitas e despesas manualmente ou importe extratos. O FinanceApp categoriza automaticamente com as regras que você definir.',
    cta: 'Entendido',
  },
  {
    icon: BarChart2,
    color: 'bg-purple-500',
    title: 'Analise seus gastos',
    body: 'Veja para onde seu dinheiro vai através de gráficos e relatórios mensais. Compare meses e identifique padrões.',
    cta: 'Entendido',
  },
  {
    icon: CalendarCheck,
    color: 'bg-amber-500',
    title: 'Crie seu planejamento',
    body: 'Defina limites por categoria e acompanhe o planejado × realizado em tempo real. Evite estourar o orçamento.',
    cta: 'Entendido',
  },
  {
    icon: Target,
    color: 'bg-rose-500',
    title: 'Defina suas metas',
    body: 'Crie objetivos financeiros — reserva de emergência, viagem, aposentadoria — e veja quanto guardar por mês para atingi-los.',
    cta: 'Começar agora!',
  },
]

export function OnboardingModal() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Icon */}
          <div className={`h-14 w-14 rounded-2xl ${current.color} flex items-center justify-center mb-5 shadow-lg`}>
            <Icon className="h-7 w-7 text-white" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{current.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{current.body}</p>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mt-5 mb-6">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-200 dark:bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button onClick={next} className={`flex-1 gap-2 ${isLast ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
              {isLast && <CheckCircle className="h-4 w-4" />}
              {current.cta}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
            <button
              onClick={dismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors whitespace-nowrap"
            >
              Pular
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
