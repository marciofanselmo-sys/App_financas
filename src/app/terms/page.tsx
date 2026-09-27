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

        <h2>4. Planos e assinatura</h2>
        <p>
          A {BRAND.name} tem um plano gratuito e planos pagos (Essencial e Completo), nas
          modalidades mensal e anual. O que cada plano inclui e o preço vigente ficam sempre
          visíveis na página de planos, dentro do app, antes da contratação.
        </p>
        <p>
          A assinatura é <strong>recorrente e renovada automaticamente</strong> ao fim de cada
          período — a cada 30 dias no plano mensal, a cada 365 dias no anual — até que você
          cancele. A cobrança é processada pela <strong>Cakto</strong>, que é quem recebe os
          dados de pagamento e emite o comprovante; a {BRAND.name} não armazena dados do seu
          cartão.
        </p>
        <p>
          Mudanças de preço não afetam períodos já pagos e são comunicadas por e-mail com
          antecedência mínima de 30 dias, valendo apenas para as renovações seguintes.
        </p>

        <h2>5. Cancelamento e arrependimento</h2>
        <p>
          Você pode cancelar a assinatura a qualquer momento. O cancelamento interrompe as
          cobranças futuras e o acesso pago permanece até o fim do período já pago — não há
          multa nem fidelidade.
        </p>
        <p>
          Nos <strong>7 primeiros dias</strong> após a contratação, você pode desistir e
          receber a devolução integral do valor, sem precisar justificar, conforme o artigo 49
          do Código de Defesa do Consumidor. Basta escrever para o nosso contato.
        </p>
        <p>
          Se o pagamento de uma renovação não for aprovado, avisamos por e-mail e o acesso
          continua liberado por um período de tolerância antes de a conta voltar ao plano
          gratuito.
        </p>

        <h2>6. O que acontece com seus dados ao sair</h2>
        <p>
          Cancelar a assinatura <strong>não apaga nada</strong>: seus lançamentos, contas,
          categorias e histórico continuam na sua conta, que volta ao plano gratuito e aos
          limites dele. Você pode exportar todos os seus dados quando quiser, em Minha conta.
        </p>
        <p>
          Apagar a conta é uma ação separada e definitiva, feita por você em Minha conta, e
          remove seus dados dos nossos sistemas.
        </p>

        <h2>7. Disponibilidade</h2>
        <p>
          Buscamos alta disponibilidade, mas o serviço pode passar por manutenções ou
          indisponibilidades temporárias. A importação de extratos depende do formato de
          arquivo fornecido por cada banco, que pode mudar sem aviso.
        </p>

        <h2>8. Encerramento pela nossa parte</h2>
        <p>
          Reservamo-nos o direito de suspender contas que violem estes termos. Em caso de
          suspensão sem violação da sua parte, devolvemos proporcionalmente o valor do período
          já pago e não utilizado.
        </p>

        <h2>9. Contato</h2>
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
