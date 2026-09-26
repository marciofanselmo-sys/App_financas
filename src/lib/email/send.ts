/**
 * E-mails transacionais pela Resend, por HTTP puro — sem dependência nova no
 * projeto para uma chamada só.
 *
 * Nenhum e-mail carrega senha: quem acabou de comprar recebe um link de uso
 * único e define a senha dele na tela de primeiro acesso.
 *
 * Falha de e-mail nunca derruba o webhook: a venda já está registrada, e o
 * cliente pode entrar por "esqueci minha senha" se o e-mail não chegar.
 */
const RESEND_URL = 'https://api.resend.com/emails'

async function send(payload: { to: string; subject: string; html: string }): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'NOBLI <boasvindas@noblifinance.com.br>'
  if (!apiKey) return { error: 'RESEND_API_KEY ausente' }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, html: payload.html }),
    })
    if (!res.ok) return { error: `resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'falha de rede' }
  }
}

const shell = (body: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f1f5f9;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="font-size:20px;font-weight:800;color:#0B2D6B;margin:0 0 4px">NOBLI</p>
    <p style="font-size:13px;color:#64748b;margin:0 0 24px">Seu dinheiro. Sob controle.</p>
    ${body}
    <p style="font-size:12px;color:#94a3b8;margin-top:28px">
      Se você não reconhece esta compra, responda este e-mail.
    </p>
  </div>
</div>`

const button = (href: string, label: string) => `
<a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
   padding:12px 20px;border-radius:12px;font-weight:600">${label}</a>`

export function sendWelcomeEmail(params: { to: string; name: string; link: string }) {
  const hi = params.name ? `Olá, ${params.name}!` : 'Olá!'
  return send({
    to: params.to,
    subject: 'Seu acesso ao NOBLI está pronto',
    html: shell(`
      <p style="font-size:16px;color:#0f172a"><strong>${hi}</strong></p>
      <p style="font-size:14px;color:#334155;line-height:1.6">
        Sua assinatura está ativa. Clique no botão abaixo para criar a sua senha e entrar no app.
        O link é de uso único e vale por 24 horas.
      </p>
      <p style="margin:24px 0">${button(params.link, 'Criar minha senha e entrar')}</p>
      <p style="font-size:13px;color:#64748b;line-height:1.6">
        Depois de entrar, o primeiro passo é cadastrar suas contas e importar o extrato do seu banco.
      </p>`),
  })
}

export function sendSubscriptionActiveEmail(params: { to: string; name: string; siteUrl: string }) {
  const hi = params.name ? `Olá, ${params.name}!` : 'Olá!'
  return send({
    to: params.to,
    subject: 'Sua assinatura do NOBLI está ativa',
    html: shell(`
      <p style="font-size:16px;color:#0f172a"><strong>${hi}</strong></p>
      <p style="font-size:14px;color:#334155;line-height:1.6">
        Recebemos seu pagamento e liberamos tudo na sua conta. É só entrar com o seu e-mail e senha de sempre.
      </p>
      <p style="margin:24px 0">${button(`${params.siteUrl}/dashboard`, 'Abrir o NOBLI')}</p>`),
  })
}
