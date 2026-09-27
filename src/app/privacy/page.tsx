import Link from 'next/link'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { BRAND } from '@/lib/brand'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 px-6 py-12">
      <div className="max-w-2xl mx-auto mb-8">
        <NobliLogo />
      </div>
      <article className="max-w-2xl mx-auto prose prose-slate dark:prose-invert">
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-slate-500">Última atualização: setembro de 2026</p>

        <h2>1. Dados que coletamos</h2>
        <p>
          Coletamos e-mail, nome de exibição e dados financeiros que você insere no app
          (transações, categorias, metas, planejamento e preferências).
        </p>

        <h2>2. Finalidade</h2>
        <p>
          Os dados são usados exclusivamente para operar a {BRAND.name}: exibir dashboards,
          relatórios, importações e funcionalidades solicitadas por você.
        </p>

        <h2>3. Armazenamento e segurança</h2>
        <p>
          Os dados ficam no Supabase (PostgreSQL) com Row Level Security — cada usuário
          acessa somente os próprios registros. Comunicação via HTTPS.
        </p>

        <h2>4. Empresas que tratam dados a nosso pedido</h2>
        <p>
          Para funcionar, o serviço se apoia em três fornecedores, cada um com acesso apenas
          ao que precisa:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — banco de dados e autenticação: guarda seu e-mail, sua
            senha (criptografada) e os lançamentos que você cadastra ou importa.
          </li>
          <li>
            <strong>Cakto</strong> — processa os pagamentos da assinatura. Os dados do seu
            cartão são fornecidos diretamente a ela e <strong>nunca passam por nós</strong>.
            Recebemos apenas a confirmação do pagamento, seu nome e seu e-mail, para liberar
            o acesso.
          </li>
          <li>
            <strong>Resend</strong> — envia os e-mails da conta (acesso, cobrança, aviso de
            renovação). Recebe apenas o e-mail de destino e o conteúdo da mensagem.
          </li>
        </ul>
        <p>
          Não vendemos, alugamos nem compartilhamos seus dados financeiros com ninguém além
          desses fornecedores, e nenhum deles os usa para finalidade própria.
        </p>

        <h2>5. Seus direitos (LGPD)</h2>
        <ul>
          <li>Acessar e exportar seus dados em Minha conta → Exportar meus dados</li>
          <li>Solicitar exclusão em Minha conta → Excluir minha conta</li>
          <li>Corrigir informações de perfil a qualquer momento</li>
        </ul>

        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre privacidade:{' '}
          <a href="mailto:contato@noblifinance.com.br" className="text-blue-600 hover:underline">
            contato@noblifinance.com.br
          </a>
          {' '}(LGPD:{' '}
          <a href="mailto:privacidade@noblifinance.com.br" className="text-blue-600 hover:underline">
            privacidade@noblifinance.com.br
          </a>
          ).
        </p>

        <p>
          <Link href="/auth/login" className="text-blue-600 hover:underline">← Voltar ao login</Link>
        </p>
      </article>
    </main>
  )
}
