'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles, BarChart2, CreditCard, ArrowLeftRight, FileText, ArrowRight,
} from 'lucide-react'
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel'
import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { BRAND } from '@/lib/brand'
import { checkAuthRateLimit, clearAuthRateLimit, recordAuthFailure } from '@/lib/auth-rate-limit'

const FEATURES = [
  { icon: BarChart2,      text: 'Dashboard com visão completa do seu patrimônio' },
  { icon: ArrowLeftRight, text: 'Multi-contas: bancos, cartões e investimentos' },
  { icon: FileText,       text: 'Importação automática de extratos bancários'  },
  { icon: CreditCard,     text: 'Parcelas, recorrências e metas em um só lugar' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [confirmEmailNotice, setConfirmEmailNotice] = useState(false)

  const [avisoLink, setAvisoLink] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('confirm') === 'email') setConfirmEmailNotice(true)

    // Quem chega por aqui veio de um link de e-mail que não valeu mais. Sem
    // esta mensagem a pessoa cai numa tela de senha que ela nunca definiu e
    // não entende o que aconteceu.
    const erro = params.get('erro')
    if (erro === 'link-expirado') {
      setAvisoLink('Esse link de acesso já foi usado ou expirou. Peça um novo abaixo — leva um minuto.')
    } else if (erro === 'link-invalido') {
      setAvisoLink('Esse link de acesso está incompleto. Peça um novo abaixo.')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const limit = checkAuthRateLimit(email)
    if (!limit.ok) {
      setError(`Muitas tentativas. Aguarde ${Math.ceil(limit.retryAfterSec / 60)} min e tente novamente.`)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      recordAuthFailure(email)
      // E-mail não confirmado não é "senha errada": a pessoa não tem o que
      // corrigir no formulário. O caminho é receber outro link.
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setAvisoLink('Falta confirmar seu e-mail. Se o link não chegou, peça outro abaixo — ele entra direto na sua conta.')
        setError('')
      } else {
        setError('E-mail ou senha incorretos.')
      }
      setLoading(false)
      return
    }
    clearAuthRateLimit(email)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel features={FEATURES} />

      <AuthFormShell
        footer={
          <p className="text-xs text-slate-400 dark:text-slate-600">
            Ao entrar, você concorda com nossos{' '}
            <Link href="/terms" className="underline hover:text-[#2563EB]">Termos de Uso</Link>
            {' '}e{' '}
            <Link href="/privacy" className="underline hover:text-[#2563EB]">Política de Privacidade</Link>.
          </p>
        }
      >
        <div className="space-y-1">
          <h2 className="font-heading text-[1.7rem] font-extrabold text-[#0B2D6B] dark:text-slate-100 tracking-tight">Bem-vindo de volta</h2>
          <p className="text-[#5B6B84] dark:text-slate-400 text-sm">{BRAND.tagline}</p>
        </div>

        <Link href="/demo" className="block group">
          <div className="rounded-2xl border border-[#2563EB]/15 dark:border-blue-500/30 bg-[#E8F2FF]/60 dark:bg-blue-900/20 px-4 py-3.5 flex items-center gap-3 hover:bg-[#E8F2FF] dark:hover:bg-blue-900/30 transition-colors">
            <div className="h-9 w-9 rounded-xl nobli-gradient flex items-center justify-center shrink-0 shadow-md shadow-[#2563EB]/25">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0B2D6B] dark:text-blue-300">Ver demonstração</p>
              <p className="text-xs text-[#5B6B84] dark:text-blue-400">Explore com dados de exemplo, sem cadastro</p>
            </div>
            <ArrowRight className="h-4 w-4 text-[#2563EB] shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-slate-100 dark:border-slate-700/80" />
          <span className="text-xs text-slate-400 shrink-0">ou entre com sua conta</span>
          <div className="flex-1 border-t border-slate-100 dark:border-slate-700/80" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {confirmEmailNotice && (
            <div className="bg-[#E8F2FF] dark:bg-blue-900/20 text-[#0B2D6B] dark:text-blue-300 text-sm p-3 rounded-xl border border-[#2563EB]/20 dark:border-blue-800/60">
              Conta criada! Confirme seu e-mail pelo link que enviamos antes de entrar.
            </div>
          )}

          {avisoLink && (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 space-y-2">
              <p>{avisoLink}</p>
              <Link href="/auth/recuperar" className="inline-block font-semibold underline">
                Receber novo link de acesso
              </Link>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800/60">
              {error}
            </div>
          )}

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
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</Label>
              <Link href="/auth/recuperar" className="text-xs text-[#2563EB] dark:text-blue-400 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 rounded-xl bg-[#E8F2FF]/40 dark:bg-slate-800/60 border-[#E2E8F0] dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:border-[#2563EB] transition-colors"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm shadow-md shadow-[#2563EB]/30 transition-all"
          >
            {loading ? 'Entrando...' : 'Entrar na conta'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Não tem uma conta?{' '}
          <Link href="/auth/register" className="text-[#2563EB] dark:text-blue-400 font-semibold hover:underline">
            Cadastre-se grátis
          </Link>
        </p>
      </AuthFormShell>
    </div>
  )
}
