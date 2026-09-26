'use client'

import Link from 'next/link'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { PricingSection } from '@/components/landing/pricing-section'
import {
  ArrowRight, FileText, Layers, CreditCard, PieChart, Target, ShieldCheck, Clock, XCircle,
} from 'lucide-react'

/**
 * Página pública do produto — a porta de entrada de quem vem de anúncio.
 *
 * Estrutura funcional com visual neutro, de propósito: o design final vem
 * depois e troca só a casca. O que precisa continuar de pé é o caminho
 * "chegou no site → entendeu o produto → criou conta ou foi para o checkout",
 * e os planos, que saem do mesmo arquivo que o app usa para liberar recurso.
 */

const DORES = [
  {
    icon: Clock,
    titulo: 'A planilha só funciona enquanto você tem ânimo',
    texto: 'Duas semanas de disciplina, um mês corrido, e ela vira um arquivo desatualizado que ninguém abre.',
  },
  {
    icon: XCircle,
    titulo: 'Digitar lançamento a lançamento é o que mata',
    texto: 'Ninguém desiste de cuidar do próprio dinheiro. Desiste de copiar 200 linhas do extrato todo mês.',
  },
  {
    icon: PieChart,
    titulo: 'No fim do mês você sabe o saldo, não para onde foi',
    texto: 'Saber que sobrou pouco não ajuda. Ajuda saber quanto foi mercado, quanto foi cartão e o que se repete todo mês.',
  },
]

const RECURSOS = [
  {
    icon: FileText,
    titulo: 'Importa o extrato do seu banco',
    texto: 'C6, Inter, Itaú, Mercado Pago, RICO e qualquer banco que exporte CSV ou OFX. O app aprende o formato e não repete lançamento que já existe.',
  },
  {
    icon: Layers,
    titulo: 'Categoriza sozinho o que se repete',
    texto: 'Você arruma uma vez e o app cria a regra. Na importação seguinte, aquilo já chega classificado.',
  },
  {
    icon: CreditCard,
    titulo: 'Cartões, parcelas e gastos fixos',
    texto: 'Mostra o que já está comprometido antes do mês começar: parcelas em andamento e as cobranças que se repetem.',
  },
  {
    icon: PieChart,
    titulo: 'Relatórios que você entende',
    texto: 'Gasto por categoria, comparação com o ano passado e a divisão entre essencial, estilo de vida e futuro.',
  },
  {
    icon: Target,
    titulo: 'Metas e investimentos no mesmo lugar',
    texto: 'Sua carteira e seus objetivos junto com o resto do dinheiro, não em outra planilha.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Seus dados são seus',
    texto: 'Cada conta enxerga só os próprios dados. Dá para exportar tudo e apagar a conta quando quiser.',
  },
]

export function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Topo */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <NobliLogo variant="compact" showTagline={false} />
          <nav className="flex items-center gap-4">
            <a href="#planos" className="hidden sm:block text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600">
              Planos
            </a>
            <Link href="/auth/login" className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600">
              Entrar
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 transition-colors"
            >
              Criar conta grátis
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100 leading-tight">
            Chega de planilha que você abandona no dia 10
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            O NOBLI importa o extrato do seu banco, organiza os gastos por categoria e mostra, em uma tela,
            para onde o seu dinheiro está indo — sem digitar lançamento por lançamento.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 transition-colors"
            >
              Começar de graça <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Ver planos
            </a>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Conta grátis, sem cartão de crédito. Funciona com o banco que você já usa.
          </p>
        </div>
      </section>

      {/* Dores */}
      <section className="px-6 py-16 bg-slate-50 dark:bg-white/[0.02]">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-center text-[#0B2D6B] dark:text-slate-100">
            Por que a planilha não dura
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {DORES.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700">
                <Icon className="h-5 w-5 text-red-500" />
                <p className="font-semibold text-slate-800 dark:text-slate-100 mt-3">{titulo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
              O que o NOBLI faz por você
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
              O trabalho chato é do app. A decisão continua sendo sua.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="space-y-2">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{titulo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />

      {/* Chamada final */}
      <section className="px-6 py-20 bg-slate-50 dark:bg-white/[0.02]">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="font-heading text-2xl md:text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
            Comece pelo mês que você está vivendo agora
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Cadastre suas contas, importe o último extrato e veja o mês inteiro organizado em minutos.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 transition-colors"
          >
            Criar minha conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="px-6 py-10 border-t border-slate-100 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <NobliLogo variant="compact" showTagline={false} />
          <div className="flex items-center gap-5 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/terms" className="hover:text-blue-600">Termos de uso</Link>
            <Link href="/privacy" className="hover:text-blue-600">Privacidade</Link>
            <Link href="/auth/login" className="hover:text-blue-600">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
