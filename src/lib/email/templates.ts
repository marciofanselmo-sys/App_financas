/**
 * E-mails transacionais do NOBLI.
 *
 * Layout propositalmente simples: HTML de tabela e estilo em linha, que é o
 * que sobrevive no Gmail, Outlook e apps de celular. O visual definitivo vem
 * do design — quando chegar, troca-se `moldura()` e os templates continuam
 * valendo.
 *
 * Duas regras que não mudam com o design:
 *  - Nenhum e-mail carrega senha. Acesso é sempre por link de uso único.
 *  - Todo e-mail diz o que aconteceu e o que fazer a seguir, sem enrolação.
 */

export interface Email {
  subject: string
  html: string
  text: string
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://noblifinance.com.br'
const SUPORTE = process.env.SUPPORT_EMAIL ?? 'contato@noblifinance.com.br'

const AZUL = '#0B2D6B'
const AZUL_BOTAO = '#2563eb'

function moldura(corpo: string, rodapeExtra?: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <tr><td>
          <p style="margin:0;font-size:20px;font-weight:800;color:${AZUL};letter-spacing:-0.3px;">NOBLI</p>
          <p style="margin:2px 0 24px;font-size:13px;color:#64748b;">Seu dinheiro. Sob controle.</p>
          ${corpo}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 16px;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
            ${rodapeExtra ? rodapeExtra + '<br>' : ''}
            Dúvida ou problema? Responda este e-mail ou escreva para
            <a href="mailto:${SUPORTE}" style="color:#64748b;">${SUPORTE}</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

const botao = (href: string, texto: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-radius:12px;background:${AZUL_BOTAO};">
    <a href="${href}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${texto}</a>
  </td></tr>
</table>`

const p = (texto: string) =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">${texto}</p>`

const titulo = (texto: string) =>
  `<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:#0f172a;">${texto}</p>`

const ola = (nome?: string) => (nome ? `Olá, ${nome.split(' ')[0]}!` : 'Olá!')

const dataBR = (iso?: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

// ── 1. Comprou e ainda não tem conta ────────────────────────────────────────
export function emailBoasVindas(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Seu acesso ao NOBLI está pronto',
    html: moldura(
      titulo(ola(params.nome)) +
      p('Sua assinatura está ativa. Para entrar, crie a sua senha no botão abaixo.') +
      botao(params.link, 'Criar minha senha') +
      p('O link é de uso único e vale por 24 horas. Se expirar, use "Esqueci minha senha" na tela de entrada.') +
      p('<strong>Primeiro passo lá dentro:</strong> cadastre suas contas e importe o extrato do seu banco. Em poucos minutos o mês inteiro fica organizado.'),
      'Você recebeu este e-mail porque assinou o NOBLI.',
    ),
    text: `${ola(params.nome)}\n\nSua assinatura do NOBLI está ativa. Crie sua senha neste link (uso único, vale 24 horas):\n${params.link}\n\nDepois de entrar, cadastre suas contas e importe o extrato do seu banco.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 2. Comprou e já tinha conta ─────────────────────────────────────────────
export function emailPlanoLiberado(params: { nome?: string; plano: string }): Email {
  return {
    subject: 'Sua assinatura do NOBLI está ativa',
    html: moldura(
      titulo(ola(params.nome)) +
      p(`Recebemos seu pagamento e liberamos o plano <strong>${params.plano}</strong> na sua conta.`) +
      p('É só entrar com o seu e-mail e a senha de sempre.') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI'),
    ),
    text: `${ola(params.nome)}\n\nSeu pagamento foi confirmado e o plano ${params.plano} está liberado. Entre em ${SITE}/dashboard com o seu e-mail e senha.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 3. Renovação não foi aprovada ───────────────────────────────────────────
export function emailPagamentoAtrasado(params: { nome?: string }): Email {
  return {
    subject: 'Não conseguimos renovar sua assinatura do NOBLI',
    html: moldura(
      titulo(ola(params.nome)) +
      p('A cobrança da renovação não foi aprovada. Costuma ser cartão vencido, limite ou uma recusa do banco.') +
      p('<strong>Seu acesso continua liberado por enquanto</strong>, e nenhum dado seu foi alterado. Só pedimos que atualize o pagamento para não perder os recursos do plano.') +
      botao(`${SITE}/settings/assinatura`, 'Ver minha assinatura'),
    ),
    text: `${ola(params.nome)}\n\nA renovação da sua assinatura do NOBLI não foi aprovada. Seu acesso continua por enquanto — atualize o pagamento em ${SITE}/settings/assinatura.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 4. Assinatura encerrada (cancelamento, reembolso ou chargeback) ─────────
export function emailAssinaturaEncerrada(params: { nome?: string; motivo: 'cancelamento' | 'reembolso' }): Email {
  const abertura = params.motivo === 'reembolso'
    ? 'Seu reembolso foi processado e a assinatura do NOBLI foi encerrada.'
    : 'Sua assinatura do NOBLI foi cancelada, como você pediu.'
  return {
    subject: 'Sua assinatura do NOBLI foi encerrada',
    html: moldura(
      titulo(ola(params.nome)) +
      p(abertura) +
      p('<strong>Nenhum dado seu foi apagado.</strong> Suas contas, lançamentos, categorias e histórico continuam aí. A conta volta para o plano grátis: os recursos pagos deixam de abrir, e o resto continua funcionando.') +
      p(`Se quiser levar tudo com você, dá para exportar seus dados a qualquer momento em <a href="${SITE}/account" style="color:${AZUL_BOTAO};">Minha conta</a>.`) +
      botao(`${SITE}/settings/assinatura`, 'Assinar de novo') +
      p('Se puder responder este e-mail contando o que faltou, ajuda muito a melhorar o produto.'),
    ),
    text: `${ola(params.nome)}\n\n${abertura}\n\nNenhum dado foi apagado — a conta volta para o plano grátis. Você pode exportar tudo em ${SITE}/account ou assinar de novo em ${SITE}/settings/assinatura.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 5. Renovou ──────────────────────────────────────────────────────────────
export function emailRenovacao(params: { nome?: string; plano: string; proximaCobranca?: string | null }): Email {
  const quando = dataBR(params.proximaCobranca)
  return {
    subject: 'Assinatura do NOBLI renovada',
    html: moldura(
      titulo(ola(params.nome)) +
      p(`Sua assinatura do plano <strong>${params.plano}</strong> foi renovada e segue ativa.`) +
      (quando ? p(`Próxima cobrança em <strong>${quando}</strong>.`) : '') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI'),
      'A nota fiscal e os detalhes da cobrança chegam pela Cakto, que processa o pagamento.',
    ),
    text: `${ola(params.nome)}\n\nSua assinatura do plano ${params.plano} foi renovada.${quando ? ` Próxima cobrança em ${quando}.` : ''}\n\n${SITE}/dashboard\n\nDúvidas: ${SUPORTE}`,
  }
}
