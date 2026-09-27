import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NobliLogo } from '@/components/brand/nobli-logo'
import { CheckCircle2, Mail, ArrowRight } from 'lucide-react'

/**
 * Página de retorno depois do pagamento na Cakto.
 *
 * Existe porque o cliente pagava e ficava parado no checkout, sem saber se
 * deu certo nem o que fazer. E os dois caminhos terminam em lugares
 * diferentes:
 *  - quem já estava logado só precisa voltar para o app;
 *  - quem comprou pelo anúncio ainda não tem senha, e precisa esperar o
 *    e-mail com o link de acesso.
 *
 * A liberação do acesso não acontece aqui: quem faz isso é o webhook. Esta
 * página não decide nada, só explica o que já está acontecendo — inclusive
 * o caso de o e-mail demorar um pouco.
 */
export default async function ObrigadoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col">
      <header className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="max-w-2xl mx-auto">
          <NobliLogo variant="compact" showTagline={false} />
        </div>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="space-y-3">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
              Pagamento recebido
            </h1>
            <p className="text-slate-600 dark:text-slate-300">
              {user
                ? 'Seu plano está sendo liberado na sua conta. Isso leva alguns segundos.'
                : 'Agora falta um passo: criar a sua senha para entrar no NOBLI.'}
            </p>
          </div>

          {user ? (
            <div className="space-y-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 transition-colors"
              >
                Voltar para o app <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Se algum recurso ainda aparecer bloqueado, recarregue a página em instantes —
                a confirmação do pagamento chega pelo banco em poucos segundos.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-3 text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <p className="font-semibold">Confira seu e-mail</p>
                  <p>
                    Enviamos um link para você criar a sua senha. Ele chega no mesmo e-mail que você
                    usou na compra, em até alguns minutos.
                  </p>
                  <p className="text-blue-700/80 dark:text-blue-300/80">
                    Não achou? Procure na caixa de spam ou em promoções.
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Já tem conta no NOBLI?{' '}
                <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline">
                  entre por aqui
                </Link>
                .
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500 pt-4">
            Qualquer problema, escreva para contato@noblifinance.com.br — a gente responde.
          </p>
        </div>
      </main>
    </div>
  )
}
