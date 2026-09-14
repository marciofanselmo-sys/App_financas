'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart2, CreditCard, ArrowLeftRight, FileText, CheckCircle2,
} from 'lucide-react'
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel'
import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { BRAND } from '@/lib/brand'
import { registerSchema } from '@/lib/schemas/auth'
import { formatUserError } from '@/lib/supabase-error'
import { checkAuthRateLimit, recordAuthFailure } from '@/lib/auth-rate-limit'
import { getAuthCallbackUrl } from '@/lib/auth-redirect'

const FEATURES = [
  { icon: BarChart2,      text: 'Dashboard com visão completa do seu patrimônio' },
  { icon: ArrowLeftRight, text: 'Multi-contas: bancos, cartões e investimentos' },
  { icon: FileText,       text: 'Importação automática de extratos bancários'  },
  { icon: CreditCard,     text: 'Parcelas, recorrências e metas em um só lugar' },
]

const BENEFITS = [
  'Sem cartão de crédito',
  'Configuração em 2 minutos',
  'Cancele quando quiser',
]

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName]                     = useState('')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const parsed = registerSchema.safeParse({ name, email, password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    const limit = checkAuthRateLimit(email)
    if (!limit.ok) {
      setError(`Muitas tentativas. Aguarde ${Math.ceil(limit.retryAfterSec / 60)} min e tente novamente.`)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: getAuthCallbackUrl('/auth/login'),
      },
    })

    if (error) {
      recordAuthFailure(email)
      setError(formatUserError(error, 'Erro ao criar conta. Tente novamente.'))
      setLoading(false)
      return
    }

    // setLoading(false) antes de navegar nos dois caminhos: sem sessão (o
    // projeto exige confirmação de e-mail) o return saía com loading ligado, e
    // o botão ficava preso em "Criando conta..." até a rota trocar. Se a
    // navegação demorasse ou falhasse, travava de vez — e a conta já tinha
    // sido criada, então tentar de novo dava "e-mail já cadastrado". (14.21)
    setLoading(false)

    if (!data.session) {
      router.push('/auth/login?confirm=email')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel features={FEATURES} />

      <AuthFormShell
        footer={
          <p className="text-xs text-slate-400 dark:text-slate-600">
            Ao criar sua conta, você concorda com nossos{' '}
            <Link href="/terms" className="underline hover:text-[#2563EB]">Termos de Uso</Link>
            {' '}e{' '}
            <Link href="/privacy" className="underline hover:text-[#2563EB]">Política de Privacidade</Link>.
          </p>
        }
      >
        <div className="space-y-1">
          <h2 className="font-heading text-[1.7rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tracking-tight">Crie sua conta</h2>
          <p className="text-[#5B6B84] dark:text-slate-400 text-sm">{BRAND.tagline}</p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {BENEFITS.map(b => (
            <div key={b} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-500 dark:text-slate-400">{b}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800/60">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              className="h-11 rounded-xl bg-[#E8F2FF]/40 dark:bg-slate-800/60 border-[#E2E8F0] dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-colors"
            />
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="h-11 rounded-xl bg-[#E8F2FF]/40 dark:bg-slate-800/60 border-[#E2E8F0] dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className="h-11 rounded-xl bg-[#E8F2FF]/40 dark:bg-slate-800/60 border-[#E2E8F0] dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-md shadow-[#2563EB]/30 transition-all"
          >
            {loading ? 'Criando conta...' : 'Criar conta grátis'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Já tem uma conta?{' '}
          <Link href="/auth/login" className="text-[#2563EB] dark:text-blue-400 font-semibold hover:underline">
            Entrar
          </Link>
        </p>
      </AuthFormShell>
    </div>
  )
}
