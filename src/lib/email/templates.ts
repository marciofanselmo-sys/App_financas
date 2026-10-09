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

const PASSOS_INICIO: [string, string][] = [
  ['Cadastre sua conta ou cartão', 'A que você mais usa no dia a dia.'],
  ['Suba o extrato em 1 clique', 'Sem senha de banco: baixe o OFX, CSV ou PDF e as regras categorizam seus gastos.'],
  ['Veja seu mês e o 50/30/20', 'Para onde foi o dinheiro, o fim das parcelas e quanto sobra para guardar.'],
]

const p = (texto: string) =>
  `<p style="margin:0 0 14px;font-size:16px;line-height:26px;color:${TEXTO};">${texto}</p>`

const ola = (nome?: string) => (nome ? `Olá, ${nome.split(' ')[0]}!` : 'Olá!')
/** Saudação do corpo: "Olá, <b>Nome</b>!". */
const olaCorpo = (nome?: string) =>
  p(nome ? `Olá, <strong style="color:${NAVY};">${nome.split(' ')[0]}</strong>!` : 'Olá!')

const dataBR = (iso?: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

// ── 0. Criou conta no plano grátis ──────────────────────────────────────────
/**
 * Boas-vindas de quem se cadastrou. A pessoa já está dentro do app quando
 * recebe — o link aqui serve para confirmar o endereço, não para liberar o
 * acesso. Por isso o texto começa pelo primeiro passo, e não pelo botão.
 */
export function emailBoasVindasCadastro(params: { nome?: string; link?: string }): Email {
  const confirmacao = params.link
    ? caixa('✉️ Confirme seu e-mail',
        p('Leva um clique e garante que você recupere a conta se esquecer a senha.') +
        botao(params.link, 'Confirmar meu e-mail'))
    : ''

  return {
    subject: 'Bem-vindo ao NOBLI',
    html: moldura(
      olaCorpo(params.nome) +
      p('Sua conta está pronta e você já pode usar o NOBLI.') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI') +
      passos('3 passos rápidos para começar hoje:', PASSOS_INICIO) +
      confirmacao,
      { titulo: 'Bem-vindo ao NOBLI 👋', sub: 'Sua conta está pronta. Vamos organizar o seu dinheiro?', rodape: 'Você recebeu este e-mail porque criou uma conta no NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSua conta no NOBLI está pronta.\n\nPrimeiro passo: cadastre uma conta ou cartão e importe o extrato do seu banco.\n${params.link ? `\nConfirme seu e-mail neste link: ${params.link}\n` : ''}\nDúvidas: ${SUPORTE}`,
  }
}

// ── 0. Esqueceu a senha (ou o convite expirou) ──────────────────────────────
export function emailRecuperacaoSenha(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Redefinir sua senha do NOBLI',
    html: moldura(
      olaCorpo(params.nome) +
      p('Recebemos um pedido para entrar na sua conta sem a senha. Use o botão abaixo para definir uma nova.') +
      botao(params.link, 'Definir nova senha') +
      p('O link é de uso único e vale por 1 hora.') +
      p('Se não foi você que pediu, pode ignorar este e-mail — nada muda na sua conta enquanto o link não for usado.'),
      { titulo: 'Redefinir sua senha 🔑', sub: 'Um link seguro para você voltar a entrar.', rodape: 'Você recebeu este e-mail porque alguém pediu a redefinição de senha desta conta no NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nUse este link para definir uma nova senha do NOBLI (uso único, vale 1 hora):\n${params.link}\n\nSe não foi você que pediu, ignore este e-mail.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 1. Comprou e ainda não tem conta ────────────────────────────────────────
export function emailBoasVindas(params: { nome?: string; link: string }): Email {
  return {
    subject: 'Seu acesso ao NOBLI está pronto',
    html: moldura(
      olaCorpo(params.nome) +
      p('Sua assinatura do NOBLI foi confirmada com sucesso. A partir de agora, suas finanças saem do modo manual e entram no piloto automático.') +
      caixa('🔐 Seu primeiro acesso',
        p('Para entrar, crie a sua senha no botão abaixo. O link é de uso único e vale por 24 horas.') +
        botao(params.link, 'Criar minha senha →') +
        `<p style="margin:0 0 12px;font-size:13px;color:#475569;"><em>Se o link expirar, use "Esqueci minha senha" na tela de entrada.</em></p>`) +
      passos('3 passos rápidos para começar hoje:', PASSOS_INICIO),
      { titulo: 'Parabéns! Seu acesso foi liberado 🚀', sub: 'Você deu o primeiro passo definitivo para ter controle total do seu dinheiro.', rodape: 'Você recebeu este e-mail porque assinou o NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSua assinatura do NOBLI está ativa. Crie sua senha neste link (uso único, vale 24 horas):\n${params.link}\n\nDepois de entrar, cadastre suas contas e importe o extrato do seu banco.\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 2. Comprou e já tinha conta ─────────────────────────────────────────────
export function emailPlanoLiberado(params: { nome?: string; plano: string }): Email {
  return {
    subject: 'Sua assinatura do NOBLI está ativa',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Recebemos seu pagamento e liberamos o plano <strong>${params.plano}</strong> na sua conta.`) +
      p('É só entrar com o seu e-mail e a senha de sempre.') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI') +
      // Rede de segurança: este e-mail vai para quem já tem conta, mas nem
      // toda conta tem senha definida. Sem esta linha, quem caísse nesse caso
      // ficava sem saída dentro do próprio e-mail de boas-novas.
      p(`Ainda não definiu uma senha? <a href="${SITE}/auth/recuperar" style="color:#2563eb;">Crie a sua aqui</a>.`),
      { titulo: 'Sua assinatura está ativa 🚀', sub: `Tudo do plano ${params.plano} já está liberado na sua conta.`, rodape: 'Você recebeu este e-mail porque assinou o NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSeu pagamento foi confirmado e o plano ${params.plano} está liberado. Entre em ${SITE}/dashboard com o seu e-mail e senha.\n\nAinda não definiu uma senha? Crie a sua em ${SITE}/auth/recuperar\n\nDúvidas: ${SUPORTE}`,
  }
}

// ── 3. Renovação não foi aprovada ───────────────────────────────────────────
export function emailPagamentoAtrasado(params: { nome?: string }): Email {
  return {
    subject: 'Não conseguimos renovar sua assinatura do NOBLI',
    html: moldura(
      olaCorpo(params.nome) +
      p('A cobrança da renovação não foi aprovada. Costuma ser cartão vencido, limite ou uma recusa do banco.') +
      caixa('⚠️ O que acontece agora',
        p('<strong>Seu acesso continua liberado por enquanto</strong>, e nenhum dado seu foi alterado. Só pedimos que atualize o pagamento para não perder os recursos do plano.')) +
      botao(`${SITE}/settings/assinatura`, 'Ver minha assinatura'),
      { titulo: 'Não conseguimos renovar sua assinatura', sub: 'Seu acesso continua liberado por enquanto.' },
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
      olaCorpo(params.nome) +
      p(abertura) +
      p('<strong>Nenhum dado seu foi apagado.</strong> Suas contas, lançamentos, categorias e histórico continuam aí. A conta volta para o plano grátis: os recursos pagos deixam de abrir, e o resto continua funcionando.') +
      p(`Se quiser levar tudo com você, dá para exportar seus dados a qualquer momento em <a href="${SITE}/account" style="color:${AZUL_BOTAO};">Minha conta</a>.`) +
      botao(`${SITE}/settings/assinatura`, 'Assinar de novo') +
      p('Se puder responder este e-mail contando o que faltou, ajuda muito a melhorar o produto.'),
      { titulo: 'Sua assinatura foi encerrada', sub: 'Nenhum dado seu foi apagado.' },
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
      olaCorpo(params.nome) +
      p(`Sua assinatura do plano <strong>${params.plano}</strong> foi renovada e segue ativa.`) +
      (quando ? p(`Próxima cobrança em <strong>${quando}</strong>.`) : '') +
      botao(`${SITE}/dashboard`, 'Abrir o NOBLI'),
      { titulo: 'Assinatura renovada ✅', sub: 'Obrigado por continuar com o NOBLI.', rodape: 'A nota fiscal e os detalhes da cobrança chegam pela Cakto, que processa o pagamento.' },
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
    html: moldura(p('Uma venda acabou de ser aprovada na Cakto.') + caixa('🧾 Dados da venda', tabela) + botao(`${SITE}/admin`, 'Abrir o painel'),
      { titulo: 'Nova venda 🎉', sub: `${params.plano} · ${valor}`, rodape: 'Aviso interno para a equipe do NOBLI.' }),
    text: `Nova venda NOBLI\n\n${linhas.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nPainel: ${SITE}/admin`,
  }
}

// ── Teste grátis de 7 dias (plano de conversão, 07/10/2026) ─────────────────
const SAIR = 'Se não quiser mais receber e-mails como este, responda com SAIR.'
const precoAnual = 'R$ 14,08/mês'

/** A1 — o teste começou (na criação da conta, ou ao entrar pelo /teste já logado). */
export function emailTesteInicio(params: { nome?: string; link?: string }): Email {
  const confirmacao = params.link
    ? caixa('✉️ Confirme seu e-mail',
        p('Leva um clique e garante que você recupere a conta se esquecer a senha.') +
        botao(params.link, 'Confirmar meu e-mail'))
    : ''
  return {
    subject: 'Seu teste de 7 dias do NOBLI começou ⏳',
    html: moldura(
      olaCorpo(params.nome) +
      p('Seu teste do NOBLI começou: você tem <strong>5 dias</strong> para colocar suas finanças em ordem — e pode ganhar até <strong>2 dias extras</strong> completando a sua jornada no app.') +
      p('O primeiro passo leva 2 minutos: crie a conta que você mais usa e importe o extrato do último mês. Só a importação vale <strong>+8 horas</strong> de teste.') +
      botao(`${SITE}/dashboard`, 'Começar agora') +
      passos('3 passos rápidos para começar hoje:', PASSOS_INICIO) +
      confirmacao,
      { titulo: 'Seu teste de 7 dias começou ⏳', sub: '5 dias para organizar suas finanças, e até 2 dias extras com a sua jornada.', rodape: 'Você recebeu este e-mail porque começou o teste grátis do NOBLI.' },
    ),
    text: `${ola(params.nome)}\n\nSeu teste do NOBLI começou: 5 dias para colocar suas finanças em ordem, e até 2 dias extras completando a sua jornada no app.\n\nPrimeiro passo: crie a conta que você mais usa e importe o extrato do último mês (+8 horas de teste).\n\nComeçar: ${SITE}/dashboard\n${params.link ? `\nConfirme seu e-mail: ${params.link}\n` : ''}\nDúvidas: ${SUPORTE}`,
  }
}

/** A2 — dia 2, só para quem ainda não importou nenhum extrato. */
export function emailTesteImportar(params: { nome?: string }): Email {
  const primeiro = params.nome ? params.nome.split(' ')[0] : ''
  return {
    subject: 'Falta o passo que mais vale no seu teste',
    html: moldura(
      olaCorpo(params.nome) +
      p('Seu NOBLI ainda está vazio. Importar o extrato do último mês é o passo que mais vale: <strong>+8 horas</strong> de teste e o seu mês organizado numa tela só.') +
      p('Funciona com OFX, CSV ou PDF do seu banco.') +
      botao(`${SITE}/transactions`, 'Importar meu extrato'),
      { titulo: 'Falta o passo que mais vale', sub: 'Importar o extrato vale +8 horas de teste.', rodape: SAIR },
    ),
    text: `${primeiro ? `${primeiro}, seu` : 'Seu'} NOBLI ainda está vazio.\n\nImportar o extrato do último mês vale +8 horas de teste e organiza seu mês numa tela só. Funciona com OFX, CSV ou PDF.\n\nImportar: ${SITE}/transactions\n\n${SAIR}`,
  }
}

export interface ResumoTeste { contas: number; lancamentos: number; fixos: number; meta?: string | null }

function frasesResumo(r: ResumoTeste): string | null {
  if (r.contas === 0 && r.lancamentos === 0) return null
  const partes = [`organizou <strong>${r.contas} conta${r.contas === 1 ? '' : 's'} e ${r.lancamentos} lançamento${r.lancamentos === 1 ? '' : 's'}</strong>`]
  if (r.fixos > 0) partes.push(`confirmou ${r.fixos} gasto${r.fixos === 1 ? '' : 's'} fixo${r.fixos === 1 ? '' : 's'}`)
  if (r.meta) partes.push(`criou a meta “${r.meta}”`)
  return `Até agora você ${partes.join(', ')}.`
}

/** A3 — último dia do teste. `quando` = 'hoje' ou 'amanhã'. */
export function emailTesteTermina(params: { nome?: string; quando: 'hoje' | 'amanhã'; resumo: ResumoTeste; checkout: string }): Email {
  const primeiro = params.nome ? params.nome.split(' ')[0] : ''
  const resumo = frasesResumo(params.resumo)
  return {
    subject: `Seu teste do NOBLI termina ${params.quando}`,
    html: moldura(
      olaCorpo(params.nome) +
      (resumo ? caixa('📊 O que você já construiu', p(resumo)) : '') +
      p('Quando o teste acabar, o planejamento, as metas e os relatórios ficam só para consulta. Assine para manter tudo liberado — nada do que você fez se perde.') +
      botao(params.checkout, `Assinar o Anual · ${precoAnual}`) +
      `<p style="margin:0 0 12px;font-size:14px;"><a href="${SITE}/settings/assinatura" style="color:${AZUL_BOTAO};">Ver os planos</a></p>`,
      { titulo: `Seu teste termina ${params.quando}`, sub: 'Assine para manter tudo liberado.', rodape: SAIR },
    ),
    text: `${primeiro ? `${primeiro}, ` : ''}seu teste do NOBLI termina ${params.quando}.\n\n${resumo ? resumo.replace(/<[^>]+>/g, '') + '\n\n' : ''}Depois disso, planejamento, metas e relatórios ficam só para consulta. Assine para manter tudo liberado.\n\nAssinar o Anual (${precoAnual}): ${params.checkout}\nVer os planos: ${SITE}/settings/assinatura\n\n${SAIR}`,
  }
}

/** A4 — o teste terminou. */
export function emailTesteTerminou(params: { nome?: string; duracao: string; checkout: string }): Email {
  const primeiro = params.nome ? params.nome.split(' ')[0] : ''
  return {
    subject: 'Seu teste terminou — e nada foi apagado',
    html: moldura(
      olaCorpo(params.nome) +
      p(`Seu teste de ${params.duracao} terminou. Tudo o que você construiu continua no app.`) +
      caixa('📌 No plano Grátis',
        p('Você segue com <strong>1 conta ativa</strong> e suas regras continuam categorizando. O resto fica só para consulta.')) +
      p('Para continuar de onde parou:') +
      botao(params.checkout, `Assinar o Anual · ${precoAnual}`) +
      `<p style="margin:0 0 12px;font-size:14px;"><a href="${SITE}/settings/assinatura" style="color:${AZUL_BOTAO};">Ver os planos</a></p>`,
      { titulo: 'Seu teste terminou', sub: 'E nada do que você construiu foi apagado.', rodape: SAIR },
    ),
    text: `${primeiro ? `${primeiro}, seu` : 'Seu'} teste de ${params.duracao} terminou.\n\nTudo o que você construiu continua no app. No Grátis: 1 conta ativa e as regras continuam funcionando; o resto fica só para consulta.\n\nAssinar o Anual (${precoAnual}): ${params.checkout}\nVer os planos: ${SITE}/settings/assinatura\n\n${SAIR}`,
  }
}

/** B — oferta do teste para quem já é Grátis (envio único, pelo Admin). */
export function emailOfertaTeste(params: { nome?: string }): Email {
  const link = `${SITE}/teste-gratis?utm_source=email&utm_campaign=gratis`
  return {
    subject: 'Liberamos 7 dias do NOBLI completo para você',
    html: moldura(
      olaCorpo(params.nome) +
      p('Você está no plano Grátis — e agora pode testar o NOBLI completo por <strong>7 dias</strong>, sem cartão: planejamento 50/30/20, metas, gastos fixos e regras automáticas.') +
      p('É só clicar: o teste começa na hora, com os dados que você já tem.') +
      botao(link, 'Começar meu teste grátis'),
      { titulo: '7 dias do NOBLI completo para você 🎁', sub: 'Sem cartão. Começa na hora, com os dados que você já tem.', rodape: SAIR },
    ),
    text: `${ola(params.nome)}\n\nVocê está no plano Grátis — e agora pode testar o NOBLI completo por 7 dias, sem cartão: planejamento 50/30/20, metas, gastos fixos e regras automáticas.\n\nComeçar: ${link}\n\n${SAIR}`,
  }
}

/** C — checkout abandonado na Cakto. */
export function emailCheckoutAbandonado(params: { nome?: string; checkout: string }): Email {
  const teste = `${SITE}/teste-gratis?utm_source=email&utm_campaign=checkout_abandonado`
  return {
    subject: 'Ficou faltando pouco para organizar seu dinheiro',
    html: moldura(
      olaCorpo(params.nome) +
      p('Vimos que você começou a assinar o NOBLI e não terminou. Se ficou alguma dúvida, é só responder este e-mail.') +
      botao(params.checkout, 'Voltar e concluir minha assinatura') +
      caixa('🧪 Prefere conhecer antes?',
        p('Teste o NOBLI completo por 7 dias, sem cartão.') +
        `<p style="margin:0;font-size:14px;"><a href="${teste}" style="color:${AZUL_BOTAO};font-weight:700;">Testar grátis por 7 dias →</a></p>`),
      { titulo: 'Ficou faltando pouco', sub: 'Sua assinatura do NOBLI está a um passo.', rodape: SAIR },
    ),
    text: `${ola(params.nome)} Vimos que você começou a assinar o NOBLI e não terminou.\n\nSe ficou alguma dúvida, é só responder este e-mail.\n\nConcluir a assinatura: ${params.checkout}\nPrefere conhecer antes? Teste grátis por 7 dias: ${teste}\n\n${SAIR}`,
  }
}
