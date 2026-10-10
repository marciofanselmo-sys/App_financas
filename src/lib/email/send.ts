import { Email } from './templates'
import { createAdminClient } from '@/lib/supabase/admin'
import { descadastrado, linkSair, linkSairUmClique } from './sair'

/**
 * Envio pela Resend, por HTTP puro — uma chamada só não justifica dependência
 * nova no projeto.
 *
 * Falha de e-mail nunca derruba o webhook: a venda já está registrada, e o
 * cliente ainda consegue entrar por "esqueci minha senha". O erro fica no log
 * do servidor para a gente ver no painel da Vercel.
 */
const RESEND_URL = 'https://api.resend.com/emails'

/**
 * Anota o envio em email_log (só data e se deu certo, sem destinatário) para o
 * painel Admin comparar com o limite da Resend. Nunca atrapalha o envio: sem a
 * tabela (migration não rodada) ou sem a chave de serviço, só não registra.
 */
async function registrarEnvio(ok: boolean) {
  try {
    const { error } = await createAdminClient().from('email_log').insert({ ok })
    if (error) console.warn('[email] email_log:', error.message)
  } catch { /* sem chave de serviço: segue sem registrar */ }
}

/**
 * `cabecalhos` extras servem às respostas do Admin: In-Reply-To/References
 * fazem a resposta cair na mesma conversa no e-mail da pessoa.
 */
export async function enviarEmail(
  para: string,
  email: Email,
  cabecalhos?: Record<string, string>,
): Promise<{ error: string | null; pulado?: true }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'NOBLI <contato@noblifinance.com.br>'

  // Lembrete ou oferta: respeita o descadastro e põe o link da pessoa.
  let headers: Record<string, string> | undefined = cabecalhos
  if (email.marketing) {
    try {
      if (await descadastrado(createAdminClient(), para)) return { error: null, pulado: true }
    } catch { /* sem chave de serviço: segue */ }
    const link = linkSair(para)
    const umClique = linkSairUmClique(para)
    const suporte = process.env.SUPPORT_EMAIL ?? 'contato@noblifinance.com.br'
    email = {
      ...email,
      html: email.html.replaceAll('{{SAIR}}', link ?? `mailto:${suporte}?subject=SAIR`),
      text: email.text.replaceAll('{{SAIR}}', link ?? `responda este e-mail com SAIR`),
    }
    // Botão "Cancelar inscrição" do Gmail/Outlook (descadastro em um clique).
    headers = {
      ...cabecalhos,
      'List-Unsubscribe': umClique ? `<${umClique}>, <mailto:${suporte}?subject=SAIR>` : `<mailto:${suporte}?subject=SAIR>`,
      ...(umClique ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}),
    }
  }

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
        ...(headers ? { headers } : {}),
      }),
    })
    if (!res.ok) {
      const detalhe = (await res.text()).slice(0, 300)
      console.error('[email] resend', res.status, detalhe)
      await registrarEnvio(false)
      return { error: `resend ${res.status}: ${detalhe}` }
    }
    await registrarEnvio(true)
    return { error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'falha de rede'
    console.error('[email] falha ao enviar:', message)
    return { error: message }
  }
}
