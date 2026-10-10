import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/admin/require-admin'
import { abrirRecebido, InboxError } from '@/lib/email/inbox'
import { emailResposta } from '@/lib/email/templates'
import { enviarEmail } from '@/lib/email/send'

/**
 * Painel /admin → E-mails → Responder. Envia pela Resend, de contato@, para o
 * Reply-To do e-mail (ou o remetente), citando a mensagem original. A
 * texto da resposta não fica guardado aqui (a cópia é a da Resend, aba Emails
 * enviados); só anotamos em inbox_replies que o e-mail foi respondido.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const enderecoDe = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim()

/** Texto do e-mail original para citar; sem versão em texto, tira as tags do HTML. */
function textoOriginal(text: string | null, html: string | null) {
  if (text?.trim()) return text
  if (!html) return ''
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirAdmin()
  if ('erro' in auth) return auth.erro
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : ''
  if (!mensagem) return NextResponse.json({ error: 'Escreva a resposta antes de enviar.' }, { status: 400 })
  if (mensagem.length > 20000) return NextResponse.json({ error: 'Resposta longa demais.' }, { status: 400 })

  try {
    const original = await abrirRecebido(id)
    const para = enderecoDe(original.reply_to[0] ?? original.from)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
      return NextResponse.json({ error: 'Não achei o endereço de quem mandou este e-mail.' }, { status: 422 })
    }
    const quando = new Date(original.created_at).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const email = emailResposta({
      assunto: original.subject,
      mensagem,
      original: { de: original.from, quando, texto: textoOriginal(original.text, original.html).slice(0, 8000) },
    })
    const cabecalhos = original.message_id
      ? { 'In-Reply-To': original.message_id, References: original.message_id }
      : undefined
    const { error } = await enviarEmail(para, email, cabecalhos)
    if (error) return NextResponse.json({ error: `Não foi possível enviar: ${error}` }, { status: 502 })

    // Já saiu: falha ao anotar não vira erro, só some o "Respondido" da lista.
    const respondidoEm = new Date().toISOString()
    const { error: erroNota } = await createAdminClient().from('inbox_replies')
      .insert({ email_id: id, replied_to: para, replied_at: respondidoEm, replied_by: auth.user.id })
    if (erroNota) console.warn('[admin/inbox] resposta enviada, mas não anotada:', erroNota.message)
    return NextResponse.json({ ok: true, para, respondidoEm })
  } catch (e) {
    const status = e instanceof InboxError ? e.status : 500
    return NextResponse.json({ error: e instanceof Error ? e.message : 'falha ao responder' }, { status })
  }
}
