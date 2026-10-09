/**
 * E-mails transacionais do NOBLI.
 *
 * Todos usam a mesma `moldura()` — a identidade visual fica num lugar só.
 *
 * Duas regras que não mudam com o design:
 *  - Nenhum e-mail carrega senha. Acesso é sempre por link de uso único.
 *  - Todo e-mail diz o que aconteceu e o que fazer a seguir, sem enrolação.
 */

export interface Email {
  subject: string
  html: string
  text: string
  /**
   * Lembrete ou oferta: quem se descadastrou não recebe, e o envio troca
   * {{SAIR}} pelo link de descadastro da pessoa (send.ts). Avisos de conta e
   * cobrança não têm isso — chegam sempre.
   */
  marketing?: true
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://noblifinance.com.br'
const SUPORTE = process.env.SUPPORT_EMAIL ?? 'contato@noblifinance.com.br'

const AZUL_BOTAO = '#2865E8'

interface Cabecalho {
  /** Título grande, em branco, no cabeçalho escuro. */
  titulo: string
  /** Uma linha abaixo do título. */
  sub?: string
  /** Nota no rodapé (por que a pessoa recebeu, como sair da lista). */
  rodape?: string
}

const LOGO = `${SITE}/nobli/email-logo.png`

// Paleta dos e-mails (padrão v2, 08/10/2026): navy para texto forte, azul
// para a ação, fundo claro e verde só para êxito.
const NAVY = '#0D1E33'
const AZUL_ACAO = '#2865E8'
const FUNDO = '#F7F9FC'
const TEXTO = '#334155'
const SUAVE = '#475569'

/**
 * Identidade dos e-mails (padrão v2, a partir da auditoria do marketing):
 * cabeçalho branco e compacto com o logo oficial, título no corpo, um botão
 * principal, caixas neutras só quando agregam e rodapé legível. Tabelas e
 * estilo em linha, que é o que sobrevive no Gmail, Outlook e celular.
 */
function moldura(corpo: string, cab: Cabecalho): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${FUNDO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};padding:24px 12px 32px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E3E8F0;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:22px 32px 18px;border-bottom:1px solid #EEF2F7;">
          <img src="${LOGO}" width="150" height="47" alt="NOBLI" style="display:block;border:0;width:150px;height:auto;">
        </td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 6px;color:${NAVY};font-size:22px;line-height:30px;font-weight:800;letter-spacing:-0.3px;">${cab.titulo}</h1>
          ${cab.sub ? `<p style="margin:0 0 20px;color:${SUAVE};font-size:15px;line-height:22px;">${cab.sub}</p>` : '<div style="height:14px;"></div>'}
          ${corpo}
          <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #EEF2F7;font-size:13px;line-height:20px;color:${SUAVE};">
            Dúvidas? Responda este e-mail ou escreva para
            <a href="mailto:${SUPORTE}" style="color:${AZUL_ACAO};">${SUPORTE}</a>.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;">
          ${cab.rodape ? `<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:${SUAVE};">${cab.rodape}</p>` : ''}
          <p style="margin:0;font-size:12px;line-height:18px;color:${SUAVE};"><strong style="color:${NAVY};">NOBLI</strong> · Seu dinheiro. Sob controle. · © ${new Date().getFullYear()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

const botao = (href: string, texto: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 22px;">
  <tr><td style="border-radius:10px;background:${AZUL_ACAO};">
    <a href="${href}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${texto}</a>
  </td></tr>
</table>`

/** Cartão de destaque com etiqueta (ex.: "🔐 Seu primeiro acesso"). */
const caixa = (etiqueta: string, conteudo: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};border:1px solid #E3E8F0;border-radius:12px;margin:4px 0 20px;">
  <tr><td style="padding:18px 20px 6px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${AZUL_ACAO};">${etiqueta}</p>
    ${conteudo}
  </td></tr>
</table>`

/** "3 passos rápidos" numerados. */
const passos = (tituloLista: string, itens: [string, string][]) => `
<h3 style="margin:26px 0 14px;font-size:16px;font-weight:800;color:${NAVY};">${tituloLista}</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itens.map(([t, d], i) => `
  <tr>
    <td width="40" valign="top" style="padding:0 12px 14px 0;"><div style="width:28px;height:28px;border-radius:50%;background:#EAF0FD;color:${AZUL_ACAO};font-weight:800;font-size:13px;line-height:28px;text-align:center;">${i + 1}</div></td>
    <td valign="top" style="padding-bottom:14px;"><strong style="font-size:15px;color:${NAVY};">${t}</strong><p style="margin:3px 0 0;font-size:14px;color:${SUAVE};line-height:21px;">${d}</p></td>
  </tr>`).join('')}
</table>`


const p = (texto: string) =>
  `<p style="margin:0 0 14px;font-size:16px;line-height:26px;color:${TEXTO};">${texto}</p>`

const ola = (nome?: string) => (nome ? `Olá, ${nome.split(' ')[0]}!` : 'Olá!')
/** Saudação do corpo: "Olá, <b>Nome</b>!". */
const olaCorpo = (nome?: string) =>
  p(nome ? `Olá, <strong style="color:${NAVY};">${nome.split(' ')[0]}</strong>!` : 'Olá!')

const dataBR = (iso?: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

// ── Regras de texto (padrão v2, 09/10/2026) ─────────────────────────────────
// Teste = "5 dias grátis, com até 2 dias extras" (nunca "7 dias"); fim do
// teste sempre com "sem cobrança"; preço anual completo; nada de "controle
// total"/"piloto automático". Emoji no início: um no título e um por etiqueta de caixa;
// no assunto, só nos de boas-vindas, teste e oferta (senha e cobrança sem).

const PRECO_ANUAL = 'R$ 169 por ano (equivale a R$ 14,08/mês)'
const OUTROS_PLANOS = `<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#475569;">Ou escolha outro plano: Mensal R$ 21 · Trimestral R$ 49. <a href="${SITE}/settings/assinatura" style="color:${AZUL_BOTAO};">Ver todos os planos</a></p>`
const linha = (texto: string) => `<p style="margin:0 0 6px;font-size:15px;line-height:23px;color:#334155;">${texto}</p>`

const PASSOS_INICIO: [string, string][] = [
  ['Escolha a conta que você mais usa', 'Conta corrente ou cartão — é por ela que o seu mês começa a aparecer.'],
  ['Importe o extrato do mês passado', 'Arquivo OFX, CSV ou PDF do seu banco. Você não precisa informar senha de banco.'],
  ['Veja para onde foi o seu dinheiro', 'Quanto entrou, quanto saiu e quais gastos mais pesaram no mês.'],
]

/** Dados reais da cobrança, vindos do webhook da Cakto. */
export interface ResumoCompra {
  plano: string
  /** "por mês", "a cada 3 meses", "por ano". */
  periodicidade?: string | null
  valor?: number | null
  metodo?: string | null
  pagoEm?: string | null
  pedido?: string | null
  proximaCobranca?: string | null
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const tabelaDados = (linhas: [string, string | null | undefined][]) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:2px 0 12px;">${linhas
  .filter(([, v]) => v)
  .map(([k, v]) => `<tr><td style="padding:5px 0;font-size:14px;color:#475569;width:150px;vertical-align:top;">${k}</td><td style="padding:5px 0;font-size:15px;color:#0D1E33;font-weight:600;">${v}</td></tr>`)
  .join('')}</table>`

/** Caixa "Resumo da compra" — só com o que a Cakto informou. */
function resumoCompra(c: ResumoCompra | undefined, etiqueta = '🧾 Resumo da compra'): string {
  if (!c) return ''
  return caixa(etiqueta, tabelaDados([
    ['Plano', `${c.plano}${c.periodicidade ? ` (cobrado ${c.periodicidade})` : ''}`],
    ['Valor', c.valor != null ? brl(c.valor) : null],
    ['Pagamento', c.metodo],
    ['Data', dataBR(c.pagoEm)],
    ['Próxima cobrança', dataBR(c.proximaCobranca)],
    ['Pedido', c.pedido ? `#${c.pedido}` : null],
  ]))
}

const confirmarEmail = (link?: string) => link
  ? caixa('✉️ Confirme seu e-mail',
      p('Assim você consegue recuperar o acesso se um dia esquecer a senha.') +
      botao(link, 'Confirmar meu e-mail'))
  : ''

// ── 1. Criou conta no plano grátis ──────────────────────────────────────────
export function emailBoasVindasCadastro(params: { nome?: string; link?: string }): Email {
  return {
    subject: '👋 Sua conta no NOBLI está pronta',
    html: moldura(
      olaCorpo(params.nome) +
      p('Comece pelo extrato do mês passado: com ele, o NOBLI separa seus gastos por categoria e mostra o que mais pesou no orçamento.') +
      botao(`${SITE}/transactions`, 'Começar minha organização') +
      passos('Em 3 passos:', PASSOS_INICIO) +
      confirmarEmail(params.link),
      { titulo: '🗂️ Vamos organizar seu primeiro mês?', sub: 'Leva poucos minutos e você já vê para onde foi o seu dinheiro.', rodape: 'Você recebeu este e-mail porque criou uma conta no NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSua conta no NOBLI está pronta. Comece pelo extrato do mês passado: o NOBLI separa seus gastos por categoria e mostra o que mais pesou.\n\nComeçar: ${SITE}/transactions\n${params.link ? `\nConfirme seu e-mail: ${params.link}\n` : ''}\nDúvidas: ${SUPORTE}`,
  }
}

// ── 2. Esqueceu a senha (ou o convite expirou) ──────────────────────────────
export function emailRecuperacaoSenha(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Redefinir sua senha do NOBLI',
    html: moldura(
      olaCorpo(params.nome) +
      p('Recebemos um pedido para redefinir a senha da sua conta. Use o botão abaixo para criar uma nova.') +
      botao(params.link, 'Definir nova senha') +
      p('Se não foi você que pediu, pode ignorar este e-mail — nada muda na sua conta enquanto o link não for usado.'),
      { titulo: '🔑 Redefina sua senha', sub: 'O link vale por 1 hora e só pode ser usado uma vez.', rodape: 'Você recebeu este e-mail porque alguém pediu a redefinição de senha desta conta no NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nUse este link para definir uma nova senha do NOBLI (uso único, vale 1 hora):\n${params.link}\n\nSe não foi você que pediu, ignore este e-mail.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 3. Comprou e ainda não tem conta ────────────────────────────────────────
export function emailBoasVindas(params: { nome?: string; link: string; plano?: string; compra?: ResumoCompra }): Email {
  const plano = params.plano ? ` do plano <strong>${params.plano}</strong>` : ''
  return {
    subject: '🎉 Seu acesso ao NOBLI está pronto',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Sua assinatura${plano} foi confirmada. Para entrar, crie a sua senha:`) +
      caixa('🔐 Seu primeiro acesso',
        p('O link abaixo é de uso único e vale por 24 horas.') +
        botao(params.link, 'Criar minha senha') +
        `<p style="margin:0 0 12px;font-size:13px;color:#475569;">Se o link expirar, use "Esqueci minha senha" na tela de entrada.</p>`) +
      resumoCompra(params.compra) +
      passos('Depois de entrar:', PASSOS_INICIO),
      { titulo: '🎉 Seu acesso está liberado', sub: 'Falta só criar a sua senha.', rodape: 'Você recebeu este e-mail porque assinou o NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSua assinatura do NOBLI${params.plano ? ` (plano ${params.plano})` : ''} foi confirmada. Crie sua senha neste link (uso único, vale 24 horas):\n${params.link}\n\nDepois de entrar, importe o extrato do mês passado para ver para onde foi o seu dinheiro.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 4. Comprou e já tinha conta ─────────────────────────────────────────────
export function emailPlanoLiberado(params: { nome?: string; plano: string; compra?: ResumoCompra }): Email {
  return {
    subject: '✅ Sua assinatura do NOBLI está ativa',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Recebemos seu pagamento e liberamos o plano <strong>${params.plano}</strong> na sua conta. Tudo o que você já tinha feito continua lá.`) +
      resumoCompra(params.compra) +
      p('É só entrar com o seu e-mail e a sua senha.') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI') +
      // Rede de segurança: este e-mail vai para quem já tem conta, mas nem
      // toda conta tem senha definida.
      p(`Ainda não definiu uma senha? <a href="${SITE}/auth/recuperar" style="color:${AZUL_BOTAO};">Crie a sua aqui</a>.`),
      { titulo: '✅ Sua assinatura está ativa', sub: `O plano ${params.plano} já está liberado na sua conta.`, rodape: 'Você recebeu este e-mail porque assinou o NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSeu pagamento foi confirmado e o plano ${params.plano} está liberado. Tudo o que você já tinha feito continua lá.\n\nEntrar: ${SITE}/dashboard\nAinda não definiu uma senha? ${SITE}/auth/recuperar\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 5. Renovação não foi aprovada ───────────────────────────────────────────
export function emailPagamentoAtrasado(params: {
  nome?: string
  plano?: string
  valor?: number | null
  /** Motivo informado pela Cakto; sem ele, não especulamos. */
  motivo?: string | null
  /** Quantas vezes a Cakto tenta de novo e de quantos em quantos dias. */
  tentativas?: number | null
  intervaloDias?: number | null
}): Email {
  const novasTentativas = params.tentativas
    ? `A cobrança é tentada de novo automaticamente${params.intervaloDias ? ` a cada ${params.intervaloDias === 1 ? 'dia' : `${params.intervaloDias} dias`}` : ''}, até ${params.tentativas} vez${params.tentativas === 1 ? '' : 'es'}. Se a forma de pagamento estiver em dia, não precisa fazer nada.`
    : null
  return {
    subject: 'Não conseguimos concluir a renovação do NOBLI',
    html: moldura(
      olaCorpo(params.nome) +
      p(`O pagamento da renovação da sua assinatura${params.plano ? ` do plano <strong>${params.plano}</strong>` : ''}${params.valor != null ? ` (${brl(params.valor)})` : ''} não foi concluído.`) +
      (params.motivo ? caixa('💳 Motivo informado pelo pagamento', p(params.motivo)) : '') +
      p('<strong>Seu acesso continua liberado por enquanto</strong> e nenhum dado seu foi alterado.') +
      (novasTentativas ? p(novasTentativas) : '') +
      p('Se o cartão mudou ou precisar de ajuda para atualizar o pagamento, é só responder este e-mail.') +
      botao(`${SITE}/settings/assinatura`, 'Ver minha assinatura'),
      { titulo: '⚠️ O pagamento da renovação não foi concluído', sub: 'Seu acesso continua liberado por enquanto.' },
    ),
    text: `${ola(params.nome)}\n\nO pagamento da renovação da sua assinatura do NOBLI não foi concluído.${params.motivo ? ` Motivo informado: ${params.motivo}.` : ''} Seu acesso continua liberado por enquanto.${novasTentativas ? `\n\n${novasTentativas}` : ''}\n\nSe o cartão mudou, responda este e-mail. Sua assinatura: ${SITE}/settings/assinatura\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 6. Assinatura encerrada (cancelamento, reembolso ou chargeback) ─────────
export function emailAssinaturaEncerrada(params: { nome?: string; motivo: 'cancelamento' | 'reembolso' }): Email {
  const abertura = params.motivo === 'reembolso'
    ? 'Seu reembolso foi processado e a assinatura do NOBLI foi encerrada.'
    : 'Sua assinatura do NOBLI foi cancelada, como você pediu.'
  return {
    subject: 'Sua assinatura do NOBLI foi encerrada',
    html: moldura(
      olaCorpo(params.nome) +
      p(abertura) +
      p('Suas contas, lançamentos, categorias e histórico continuam guardados. A conta volta para o plano Grátis: os recursos pagos ficam só para consulta e o resto continua funcionando.') +
      p(`Se quiser levar tudo com você, exporte seus dados em <a href="${SITE}/account" style="color:${AZUL_BOTAO};">Minha conta</a>.`) +
      botao(`${SITE}/settings/assinatura`, 'Assinar de novo') +
      p('Se puder, responda este e-mail contando o que faltou. Isso ajuda muito a melhorar o NOBLI.'),
      { titulo: '📁 Sua assinatura foi encerrada', sub: 'Seus dados continuam guardados.' },
    ),
    text: `${ola(params.nome)}\n\n${abertura}\n\nSeus dados continuam guardados e a conta volta para o plano Grátis. Exportar: ${SITE}/account — Assinar de novo: ${SITE}/settings/assinatura\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 7. Renovou ──────────────────────────────────────────────────────────────
export function emailRenovacao(params: { nome?: string; plano: string; proximaCobranca?: string | null; compra?: ResumoCompra }): Email {
  const quando = dataBR(params.proximaCobranca ?? params.compra?.proximaCobranca)
  const compra = params.compra ? { ...params.compra, proximaCobranca: params.proximaCobranca ?? params.compra.proximaCobranca } : undefined
  return {
    subject: 'Assinatura do NOBLI renovada',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Sua assinatura do plano <strong>${params.plano}</strong> foi renovada e segue ativa.`) +
      (compra ? resumoCompra(compra, '🧾 Resumo da renovação') : (quando ? p(`Próxima cobrança em <strong>${quando}</strong>.`) : '')) +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI'),
      { titulo: '✅ Assinatura renovada', sub: 'Obrigado por continuar com o NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSua assinatura do plano ${params.plano} foi renovada.${compra?.valor != null ? ` Valor: ${brl(compra.valor)}.` : ''}${quando ? ` Próxima cobrança em ${quando}.` : ''}\n\n${SITE}/dashboard\n\nDúvidas: ${SUPORTE}`,
  }
}

/**
 * Aviso interno de venda nova — vai para a equipe (SALES_NOTIFY_EMAILS), não
 * para o cliente. Modelo operacional próprio: sem logo, sem bloco de ajuda,
 * só os dados para conferir a venda na Cakto. Nada de senha nem link de acesso.
 */
export function emailNovaVenda(params: {
  plano: string
  periodicidade?: string | null
  valor?: number | null
  cliente?: string | null
  email: string
  metodo?: string | null
  data?: string | null
  pedido?: string | null
  transacao?: string | null
  origem?: string | null
}): Email {
  const valor = params.valor != null ? brl(params.valor) : '—'
  const quando = params.data ? new Date(params.data) : new Date()
  const dataHora = `${quando.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`
  const linhas: [string, string | null | undefined][] = [
    ['Plano', `${params.plano}${params.periodicidade ? ` (${params.periodicidade})` : ''}`],
    ['Valor', valor],
    ['Pagamento', params.metodo],
    ['Data', dataHora],
    ['Cliente', params.cliente || '—'],
    ['E-mail', params.email],
    ['Origem', params.origem || 'direto (sem UTM)'],
    ['Pedido', params.pedido ? `#${params.pedido}` : null],
    ['ID da transação', params.transacao],
  ]
  const tabela = linhas.filter(([, v]) => v).map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#475569;width:130px;vertical-align:top;border-bottom:1px solid #EEF2F7;">${k}</td><td style="padding:6px 0;font-size:14px;color:#0D1E33;font-weight:600;border-bottom:1px solid #EEF2F7;word-break:break-all;">${v}</td></tr>`).join('')
  return {
    subject: `💰 Nova venda · ${params.plano} · ${valor}`,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F9FC;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:20px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E3E8F0;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr><td style="padding:20px 24px 8px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#475569;">NOBLI · aviso interno</p>
          <p style="margin:0 0 14px;font-size:20px;font-weight:800;color:#0D1E33;">💰 Nova venda · ${valor}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tabela}</table>
          <p style="margin:16px 0 18px;font-size:14px;"><a href="${SITE}/admin" style="color:#2865E8;font-weight:700;">Abrir o painel →</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Nova venda NOBLI\n\n${linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nPainel: ${SITE}/admin`,
  }
}

// ── Teste grátis: 5 dias + até 2 dias extras (plano de conversão) ──────────
// {{SAIR}} vira o link de descadastro da pessoa no envio (send.ts).
const SAIR = 'Não quer mais receber lembretes e ofertas do NOBLI? <a href="{{SAIR}}" style="color:#475569;text-decoration:underline;">Cancelar inscrição</a>. Avisos da sua conta e de cobrança continuam chegando.'
const SAIR_TXT = 'Para não receber mais lembretes e ofertas: {{SAIR}}'

const horaBR = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** 9 — o teste começou (na criação da conta, ou ao entrar pelo /teste já logado). */
export function emailTesteInicio(params: { nome?: string; link?: string }): Email {
  return {
    subject: '⏳ Seu teste do NOBLI começou: 5 dias grátis',
    html: moldura(
      olaCorpo(params.nome) +
      p('Você tem 5 dias para conhecer o NOBLI completo. Comece pelo extrato do mês passado: com ele, você vê quais gastos mais pesaram no seu orçamento.') +
      botao(`${SITE}/transactions`, 'Começar minha organização') +
      caixa('⏱️ Como ganhar mais tempo',
        p('Cada tarefa da sua jornada no app soma horas ao teste, até <strong>2 dias extras</strong>. A que mais vale é importar o primeiro extrato: <strong>+8 horas</strong>. O relógio no topo do app mostra quanto tempo falta.')) +
      confirmarEmail(params.link),
      { titulo: '⏳ Seu teste grátis começou', sub: '5 dias para conhecer o NOBLI, sem cartão e sem cobrança.', rodape: 'Você recebeu este e-mail porque começou o teste grátis do NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSeu teste do NOBLI começou: 5 dias grátis, sem cartão e sem cobrança. Cada tarefa no app soma horas ao teste, até 2 dias extras — importar o primeiro extrato vale +8 horas.\n\nComeçar: ${SITE}/transactions\n${params.link ? `\nConfirme seu e-mail: ${params.link}\n` : ''}\nDúvidas: ${SUPORTE}`,
  }
}

/** 10 — dia 2, só para quem ainda não importou nenhum extrato. */
export function emailTesteImportar(params: { nome?: string }): Email {
  return {
    subject: '🔍 Descubra o que mais pesou no seu último mês',
    html: moldura(
      olaCorpo(params.nome) +
      p('Com o extrato do mês passado, o NOBLI separa seus gastos por categoria e mostra o que mais pesou: mercado, delivery, assinaturas, parcelas.') +
      p('Funciona com o arquivo OFX, CSV ou PDF do seu banco. Você não precisa informar senha de banco.') +
      botao(`${SITE}/transactions`, 'Importar meu extrato') +
      p('<span style="font-size:14px;color:#475569;">De quebra, importar o primeiro extrato soma 8 horas ao seu teste (os extras chegam a até 2 dias).</span>'),
      { titulo: '🔍 Seu primeiro extrato pode revelar muito sobre seus gastos', sub: 'Importe o mês passado e veja para onde foi o seu dinheiro.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nCom o extrato do mês passado, o NOBLI separa seus gastos por categoria e mostra o que mais pesou. Funciona com OFX, CSV ou PDF, sem senha de banco.\n\nImportar: ${SITE}/transactions\n\nImportar o primeiro extrato soma 8 horas ao seu teste (os extras chegam a até 2 dias).\n\n${SAIR_TXT}`,
    marketing: true,
  }
}

export interface ResumoTeste { contas: number; lancamentos: number; fixos: number; meta?: string | null }

function itensResumo(r: ResumoTeste): string | null {
  if (r.contas === 0 && r.lancamentos === 0) return null
  const itens = [`${r.contas} conta${r.contas === 1 ? '' : 's'} e ${r.lancamentos} lançamento${r.lancamentos === 1 ? '' : 's'} organizados`]
  if (r.fixos > 0) itens.push(`${r.fixos} gasto${r.fixos === 1 ? '' : 's'} fixo${r.fixos === 1 ? '' : 's'} confirmado${r.fixos === 1 ? '' : 's'}`)
  if (r.meta) itens.push(`a meta “${r.meta}”`)
  return itens.map(i => linha(`• ${i}`)).join('')
}

const OQUE_MUDA = caixa('🔄 O que muda quando o teste acaba',
  linha('• Sua conta volta ao plano Grátis, <strong>sem cobrança</strong>.') +
  linha('• Você continua com 1 conta ativa e suas regras seguem categorizando.') +
  linha('• Planejamento, metas, gastos fixos e relatórios ficam só para consulta.') +
  linha('• Nada do que você fez é apagado.') + '<div style="height:10px;"></div>')

/** 11 — último dia do teste. `quando` = 'hoje' ou 'amanhã'; `fim` = hora real do fim. */
export function emailTesteTermina(params: { nome?: string; quando: 'hoje' | 'amanhã'; fim: Date; resumo: ResumoTeste; checkout: string }): Email {
  const resumo = itensResumo(params.resumo)
  return {
    subject: `⏰ Seu teste do NOBLI termina ${params.quando}`,
    html: moldura(
      olaCorpo(params.nome) +
      (resumo ? caixa('📊 O que você já organizou', resumo + '<div style="height:10px;"></div>') : '') +
      OQUE_MUDA +
      p(`Para manter tudo liberado, assine o plano Anual: <strong>${PRECO_ANUAL}</strong>. Cancele quando quiser.`) +
      botao(params.checkout, 'Assinar o plano Anual') +
      OUTROS_PLANOS,
      { titulo: `⏰ Seu teste termina ${params.quando}, às ${horaBR(params.fim)}`, sub: 'Depois disso sua conta volta ao plano Grátis, sem cobrança.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nSeu teste do NOBLI termina ${params.quando}, às ${horaBR(params.fim)}. Depois disso a conta volta ao plano Grátis, sem cobrança: 1 conta ativa, regras funcionando, e planejamento, metas, gastos fixos e relatórios só para consulta. Nada é apagado.\n\nPlano Anual: ${PRECO_ANUAL}. Assinar: ${params.checkout}\nOutros planos (Mensal R$ 21 · Trimestral R$ 49): ${SITE}/settings/assinatura\n\n${SAIR_TXT}`,
    marketing: true,
  }
}

/** 12 — o teste terminou. `horasExtras` = bônus ganho na jornada (0 a 48). */
export function emailTesteTerminou(params: { nome?: string; horasExtras: number; checkout: string }): Email {
  const extra = params.horasExtras > 0 ? ` + as ${params.horasExtras} horas extras que você ganhou` : ''
  return {
    subject: 'Seu teste do NOBLI terminou',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Seus 5 dias de teste${extra} terminaram. Tudo o que você construiu continua na sua conta.`) +
      caixa('📌 No plano Grátis',
        linha('• <strong>Continua:</strong> 1 conta ativa (você escolhe qual), suas regras categorizando e todos os seus dados visíveis.') +
        linha('• <strong>Fica só para consulta:</strong> planejamento, metas, gastos fixos e relatórios.') + '<div style="height:10px;"></div>') +
      p(`Para continuar de onde parou, assine o plano Anual: <strong>${PRECO_ANUAL}</strong>. Cancele quando quiser.`) +
      botao(params.checkout, 'Assinar o plano Anual') +
      OUTROS_PLANOS,
      { titulo: '📌 Seu teste terminou', sub: 'Você está no plano Grátis. Nada foi apagado e não houve cobrança.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nSeus 5 dias de teste${extra} terminaram. Você está no plano Grátis: nada foi apagado e não houve cobrança. Continua: 1 conta ativa e suas regras. Só consulta: planejamento, metas, gastos fixos e relatórios.\n\nPlano Anual: ${PRECO_ANUAL}. Assinar: ${params.checkout}\nOutros planos: ${SITE}/settings/assinatura\n\n${SAIR_TXT}`,
    marketing: true,
  }
}

/** 13 — oferta do teste para quem já é Grátis (envio único, pelo Admin). */
export function emailOfertaTeste(params: { nome?: string }): Email {
  const link = `${SITE}/teste-gratis?utm_source=email&utm_campaign=gratis`
  return {
    subject: '🎁 Teste o NOBLI completo: 5 dias grátis',
    html: moldura(
      olaCorpo(params.nome) +
      p('Você usa o plano Grátis. Agora pode testar o NOBLI completo por <strong>5 dias</strong>: planejamento do mês, metas, gastos fixos e regras automáticas — e ganhar até <strong>2 dias extras</strong> usando o app.') +
      p('O teste começa na hora, com os dados que você já tem. Não pede cartão e não gera cobrança.') +
      botao(link, 'Começar meu teste grátis'),
      { titulo: '🎁 Libere o NOBLI completo por 5 dias', sub: 'Sem cartão e sem cobrança, com os dados que você já tem.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nVocê usa o plano Grátis. Agora pode testar o NOBLI completo por 5 dias (com até 2 dias extras usando o app), sem cartão e sem cobrança.\n\nComeçar: ${link}\n\n${SAIR_TXT}`,
    marketing: true,
  }
}

/** 14 — checkout abandonado na Cakto. */
export function emailCheckoutAbandonado(params: { nome?: string; checkout: string }): Email {
  const teste = `${SITE}/teste-gratis?utm_source=email&utm_campaign=checkout_abandonado`
  return {
    subject: 'Sua assinatura do NOBLI ficou pela metade',
    html: moldura(
      olaCorpo(params.nome) +
      p('Vimos que você começou a assinar o NOBLI e não concluiu. Se foi algum problema no pagamento ou ficou dúvida sobre os planos, é só responder este e-mail.') +
      botao(params.checkout, 'Concluir minha assinatura') +
      caixa('🧪 Prefere conhecer antes?',
        p(`Teste o NOBLI por 5 dias grátis, sem cartão — e ganhe até 2 dias extras usando o app. <a href="${teste}" style="color:${AZUL_BOTAO};font-weight:700;">Começar o teste grátis</a>`)),
      { titulo: '💬 Ficou alguma dúvida?', sub: 'Sua assinatura está a um passo.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nVimos que você começou a assinar o NOBLI e não concluiu. Se ficou alguma dúvida, responda este e-mail.\n\nConcluir: ${params.checkout}\nPrefere conhecer antes? 5 dias grátis, sem cartão: ${teste}\n\n${SAIR_TXT}`,
    marketing: true,
  }
}
