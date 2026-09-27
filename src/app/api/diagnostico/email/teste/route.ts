import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarEmail } from '@/lib/email/send'

/**
 * Envia um e-mail de teste de verdade pela Resend.
 *
 * O diagnóstico ao lado só confirma que a chave é aceita; entregar mesmo
 * depende também do domínio verificado, e isso só se vê mandando um. A chave
 * é "sensível" na Vercel (não dá para baixar), então o envio tem que sair
 * daqui do servidor.
 *
 * Só para quem está logado, e só para o próprio e-mail da sessão — não aceita
 * destinatário de fora, para não virar um disparador de e-mail aberto.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ ok: false, motivo: 'entre na sua conta antes de abrir este link' }, { status: 401 })
  }

  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const { error } = await enviarEmail(user.email, {
    subject: 'Teste de envio — NOBLI',
    html: `<p>Olá!</p><p>Este é um e-mail de teste do <strong>NOBLI</strong>, enviado em ${quando}, para confirmar que o envio pela Resend está funcionando.</p><p>Se você recebeu, está tudo certo.</p>`,
    text: `Olá! Este é um e-mail de teste do NOBLI, enviado em ${quando}, para confirmar que o envio pela Resend está funcionando. Se você recebeu, está tudo certo.`,
  })

  if (error) {
    return NextResponse.json({ ok: false, motivo: error, para: user.email })
  }
  return NextResponse.json({
    ok: true,
    para: user.email,
    remetente: process.env.RESEND_FROM ?? 'NOBLI <contato@noblifinance.com.br>',
    aviso: 'Aceito pela Resend. Confira a caixa de entrada (e o spam) em até alguns minutos.',
  })
}
