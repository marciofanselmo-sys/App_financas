import { Email } from './templates'

/**
 * Envio pela Resend, por HTTP puro — uma chamada só não justifica dependência
 * nova no projeto.
 *
 * Falha de e-mail nunca derruba o webhook: a venda já está registrada, e o
 * cliente ainda consegue entrar por "esqueci minha senha". O erro fica no log
 * do servidor para a gente ver no painel da Vercel.
 */
const RESEND_URL = 'https://api.resend.com/emails'

export async function enviarEmail(para: string, email: Email): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'NOBLI <contato@noblifinance.com.br>'

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY ausente — e-mail não enviado:', email.subject, '→', para)
    return { error: 'RESEND_API_KEY ausente' }
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [para],
        subject: email.subject,
        html: email.html,
        // Versão em texto: melhora a entrega e atende quem lê e-mail sem HTML.
        text: email.text,
      }),
    })
    if (!res.ok) {
      const detalhe = (await res.text()).slice(0, 300)
      console.error('[email] resend', res.status, detalhe)
      return { error: `resend ${res.status}: ${detalhe}` }
    }
    return { error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'falha de rede'
    console.error('[email] falha ao enviar:', message)
    return { error: message }
  }
}
