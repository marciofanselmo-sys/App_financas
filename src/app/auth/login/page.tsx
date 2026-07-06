'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  TrendingUp, Sparkles, Shield, BarChart2, CreditCard,
  ArrowLeftRight, ArrowRight, FileText,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

const FEATURES = [
  { icon: BarChart2,      text: 'Dashboard com visão completa do seu dinheiro' },
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Painel esquerdo — Marca ────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900">

        {/* Decorações de fundo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-16 -left-24 w-80 h-80 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="absolute top-1/2 right-0 w-64 h-64 rounded-full bg-blue-300/5 blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
          />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">FinanceApp</span>
        </div>

        {/* Conteúdo central */}
        <div className="relative space-y-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-blue-100 font-medium">100% gratuito para começar</span>
            </div>
            <h1 className="text-4xl font-bold text-white leading-[1.15] tracking-tight">
              Suas finanças,<br />finalmente<br />no controle.
            </h1>
            <p className="text-blue-200 text-base leading-relaxed max-w-xs">
              Tudo que você precisa para organizar, acompanhar e planejar sua vida financeira em um só lugar.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-blue-200" />
                </div>
                <span className="text-sm text-blue-100">{text}</span>
              </div>
            ))}
          </div>

          {/* Mini dashboard decorativo */}
          <div className="bg-white/8 border border-white/10 rounded-2xl p-4 backdrop-blur-sm space-y-3.5 max-w-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wide">Resumo do mês</span>
              <span className="text-[11px] text-blue-300/70">Julho 2026</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/8 rounded-xl p-2.5">
                <p className="text-[10px] text-blue-300/80 mb-1">Receitas</p>
                <p className="text-sm font-bold text-emerald-300">R$ 8.500</p>
              </div>
              <div className="bg-white/8 rounded-xl p-2.5">
                <p className="text-[10px] text-blue-300/80 mb-1">Despesas</p>
                <p className="text-sm font-bold text-red-300">R$ 4.230</p>
              </div>
              <div className="bg-white/8 rounded-xl p-2.5">
                <p className="text-[10px] text-blue-300/80 mb-1">Saldo</p>
                <p className="text-sm font-bold text-white">R$ 4.270</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Alimentação', pct: 35, color: 'bg-amber-400' },
                { label: 'Moradia',      pct: 28, color: 'bg-violet-400' },
                { label: 'Transporte',  pct: 15, color: 'bg-blue-300'   },
              ].map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-blue-300/80 w-20 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} opacity-80`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-blue-300/60 w-6 text-right shrink-0">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé do painel */}
        <div className="relative flex items-center gap-2 text-blue-300/60 text-xs">
          <Shield className="h-3.5 w-3.5" />
          <span>Seus dados são privados e protegidos</span>
        </div>
      </div>

      {/* ── Painel direito — Formulário ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen bg-white dark:bg-slate-900">

        {/* Barra superior */}
        <div className="flex items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-2 lg:hidden">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-slate-800 dark:text-slate-100">FinanceApp</span>
          </div>
          <div className="hidden lg:block" />
          <ThemeToggle />
        </div>

        {/* Área do formulário */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 lg:px-16">
          <div className="w-full max-w-sm space-y-6">

            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo de volta</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Entre na sua conta para continuar</p>
            </div>

            {/* Demo CTA */}
            <Link href="/demo" className="block group">
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-center gap-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/25">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Ver demonstração</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">Explore com dados de exemplo, sem cadastro</p>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-100 dark:border-slate-700/80" />
              <span className="text-xs text-slate-400 shrink-0">ou entre com sua conta</span>
              <div className="flex-1 border-t border-slate-100 dark:border-slate-700/80" />
            </div>

            {/* Formulário */}
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800/60">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 transition-colors"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-600/20 transition-all"
              >
                {loading ? 'Entrando...' : 'Entrar na conta'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              Não tem uma conta?{' '}
              <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Cadastre-se grátis
              </Link>
            </p>
          </div>
        </div>

        {/* Rodapé do formulário */}
        <div className="px-6 py-4 lg:px-10 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            Ao entrar, você concorda com nossos termos de uso e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  )
}
