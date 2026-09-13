import Link from 'next/link'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { BRAND } from '@/lib/brand'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 px-6 py-12">
      <div className="max-w-2xl mx-auto mb-8">
        <NobliLogo />
      </div>
      <article className="max-w-2xl mx-auto prose prose-slate dark:prose-invert">
        <h1>Termos de Uso</h1>
        <p className="text-sm text-slate-500">Última atualização: setembro de 2026</p>

        <h2>1. Aceitação</h2>
        <p>
          Ao criar uma conta ou usar a {BRAND.name}, você concorda com estes termos e com a
          nossa Política de Privacidade.
        </p>

        <h2>2. Uso permitido</h2>
        <p>
          O app destina-se à gestão financeira pessoal. É proibido tentar acessar dados de
          outros usuários, explorar vulnerabilidades ou usar o serviço de forma abusiva.
        </p>

        <h2>3. Responsabilidade</h2>
        <p>
          Você é responsável pela veracidade dos dados inseridos e pela segurança da sua senha.
          A {BRAND.name} é uma ferramenta de apoio — não substitui assessoria financeira ou contábil.
        </p>

        <h2>4. Disponibilidade</h2>
        <p>
          Buscamos alta disponibilidade, mas o serviço pode passar por manutenções ou
          indisponibilidades temporárias.
        </p>

        <h2>5. Encerramento</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento em Minha conta. Reservamo-nos o
          direito de suspender contas que violem estes termos.
        </p>

        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre estes termos:{' '}
          <a href="mailto:contato@noblifinance.com.br" className="text-blue-600 hover:underline">
            contato@noblifinance.com.br
          </a>
          .
        </p>

        <p>
          <Link href="/privacy" className="text-blue-600 hover:underline">Política de Privacidade</Link>
          {' · '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">Voltar ao login</Link>
        </p>
      </article>
    </main>
  )
}
