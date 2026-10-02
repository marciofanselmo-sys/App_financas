'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel'
import { MailCheck, KeyRound, FileText, CreditCard } from 'lucide-react'

const FEATURES = [
  { icon: KeyRound,   text: 'Link de uso único, sem senha por e-mail'       },
  { icon: FileText,   text: 'Seus lançamentos continuam como você deixou'   },
  { icon: CreditCard, text: 'Sua assinatura não é afetada'                  },
]

/**
 * Recuperação de senha.
 *
 * Quem compra pelo anúncio nunca escolheu uma senha — a conta nasce no
 * webhook e o acesso chega por link. Se esse link expira (24 horas) ou é
 * clicado duas vezes, esta tela é o único caminho de volta para uma conta
 * que a pessoa já pagou.
 *
 * A confirmação é sempre a mesma, exista a conta ou não: dizer "não achei
 * esse e-mail" entregaria quem é cliente para qualquer um que perguntasse.
 */
export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // Quem vem da tela de cadastro já digitou o e-mail uma vez; pedir de novo
  // seria só mais um degrau entre o cliente e a conta que ele já pagou.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vindo = new URLSearchParams(window.location.search).get('email')
    if (vindo) setEmail(vindo)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    try {
      await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Mesmo com falha de rede a tela confirma: a pessoa tenta de novo pelo
      // botão de reenviar, e não ficamos dizendo se o e-mail existe.
    }
    setEnviado(true)
    setEnviando(false)
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel features={FEATURES} />

      <AuthFormShell>
        {enviado ? (
          <div className="space-y-5">
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <MailCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-[1.7rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tracking-tight">
                Confira seu e-mail
              </h2>
              <p className="text-[#5B6B84] dark:text-slate-400 text-sm">
                Se existir uma conta com <strong>{email}</strong>, enviamos um link para você
                definir uma nova senha. Ele vale por 1 hora e só pode ser usado uma vez.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Não chegou em alguns minutos? Procure no spam ou na aba Promoções.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href="/auth/login"
                className="h-12 inline-flex items-center justify-center rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition-colors"
              >
                Voltar para a entrada
              </Link>
              <button
                type="button"
                onClick={() => setEnviado(false)}
                className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
              >
                Usar outro e-mail
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h2 className="font-heading text-[1.7rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tracking-tight">
                Esqueceu a senha?
              </h2>
              <p className="text-[#5B6B84] dark:text-slate-400 text-sm">
                Informe o e-mail da sua conta e enviamos um link para você definir uma nova.
                Se você comprou e nunca criou senha, é por aqui também.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl bg-[#E8F2FF]/40 dark:bg-slate-800/60 border-[#E2E8F0] dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-colors"
                />
              </div>

              <Button
                type="submit"
                disabled={enviando}
                className="w-full h-12 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-md shadow-[#2563EB]/30 transition-all"
              >
                {enviando ? 'Enviando...' : 'Enviar link de acesso'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Lembrou a senha?{' '}
              <Link href="/auth/login" className="text-[#2563EB] dark:text-blue-400 font-semibold hover:underline">
                Voltar para a entrada
              </Link>
            </p>
          </>
        )}
      </AuthFormShell>
    </div>
  )
}
