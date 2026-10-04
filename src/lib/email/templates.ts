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

// ── 0. Criou conta no plano grátis ──────────────────────────────────────────
export function emailConfirmacaoCadastro(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Confirme seu e-mail e entre no NOBLI',
    html: moldura(
      titulo(ola(params.nome)) +
      p('Sua conta foi criada. Confirme o e-mail no botão abaixo para entrar.') +
      botao(params.link, 'Confirmar e entrar') +
      p('O link é de uso único e vale por 24 horas.') +
      p('<strong>Primeiro passo lá dentro:</strong> cadastre uma conta e importe o extrato do seu banco. Em poucos minutos o mês fica organizado.'),
      'Você recebeu este e-mail porque criou uma conta no NOBLI.',
    ),
    text: `${ola(params.nome)}\n\nSua conta no NOBLI foi criada. Confirme seu e-mail neste link (uso único, vale 24 horas):\n${params.link}\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 0. Esqueceu a senha (ou o convite expirou) ──────────────────────────────
export function emailRecuperacaoSenha(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Redefinir sua senha do NOBLI',
    html: moldura(
      titulo(ola(params.nome)) +
      p('Recebemos um pedido para entrar na sua conta sem a senha. Use o botão abaixo para definir uma nova.') +
      botao(params.link, 'Definir nova senha') +
      p('O link é de uso único e vale por 1 hora.') +
      p('Se não foi você que pediu, pode ignorar este e-mail — nada muda na sua conta enquanto o link não for usado.'),
      'Você recebeu este e-mail porque alguém pediu a redefinição de senha desta conta no NOBLI.',
    ),
    text: `${ola(params.nome)}\n\nUse este link para definir uma nova senha do NOBLI (uso único, vale 1 hora):\n${params.link}\n\nSe não foi você que pediu, ignore este e-mail.\n\nDúvidas: ${SUPORTE}`,
  }
}

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
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI') +
      // Rede de segurança: este e-mail vai para quem já tem conta, mas nem
      // toda conta tem senha definida. Sem esta linha, quem caísse nesse caso
      // ficava sem saída dentro do próprio e-mail de boas-novas.
      p(`Ainda não definiu uma senha? <a href="${SITE}/auth/recuperar" style="color:#2563eb;">Crie a sua aqui</a>.`),
    ),
    text: `${ola(params.nome)}\n\nSeu pagamento foi confirmado e o plano ${params.plano} está liberado. Entre em ${SITE}/dashboard com o seu e-mail e senha.\n\nAinda não definiu uma senha? Crie a sua em ${SITE}/auth/recuperar\n\nDúvidas: ${SUPORTE}`,
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

/**
 * Aviso interno de venda nova — vai para a equipe (SALES_NOTIFY_EMAILS), não
 * para o cliente. Só dados da venda; nada de senha nem link de acesso.
 */
export function emailNovaVenda(params: {
  plano: string
  valor?: number | null
  cliente?: string | null
  email: string
  metodo?: string | null
  data?: string | null
}): Email {
  const valor = params.valor != null
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(params.valor)
    : '—'
  const linhas: [string, string][] = [
    ['Plano', params.plano],
    ['Valor', valor],
    ['Cliente', params.cliente || '—'],
    ['E-mail', params.email],
    ['Pagamento', params.metodo || '—'],
    ['Data', dataBR(params.data) || dataBR(new Date().toISOString())],
  ]
  const tabela = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 4px;">${linhas
    .map(([k, v]) => `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:110px;">${k}</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${v}</td></tr>`)
    .join('')}</table>`
  return {
    subject: `Nova venda NOBLI · ${params.plano} · ${valor}`,
    html: moldura(titulo('Nova venda 🎉') + p('Uma venda acabou de ser aprovada na Cakto.') + tabela + botao(`${SITE}/admin`, 'Abrir o painel')),
    text: `Nova venda NOBLI\n\n${linhas.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nPainel: ${SITE}/admin`,
  }
}
