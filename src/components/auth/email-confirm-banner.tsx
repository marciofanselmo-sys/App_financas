'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MailWarning, Check } from 'lucide-react'

/**
 * Aviso de e-mail ainda não confirmado.
 *
 * O cadastro não exige confirmação — quem vem de anúncio entra direto, porque
 * cada passo a mais no caminho custa gente que já foi paga. A verificação
 * acontece aqui, sem bloquear nada: o aviso fica no topo até a pessoa clicar
 * no link, e some sozinho depois.
 *
 * Confirmar importa por um motivo concreto, que o texto diz: sem o endereço
 * confirmado, não há como recuperar a conta se a senha for esquecida.
 */
export function EmailConfirmBanner() {
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false)
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !user.email_confirmed_at) {
        setPrecisaConfirmar(true)
        setEmail(user.email ?? '')
      }
    })
  }, [])

  if (!precisaConfirmar) return null

  async function reenviar() {
    setEnviando(true)
    try {
      await fetch('/api/auth/confirmar-email', { method: 'POST' })
      setEnviado(true)
    } catch {
      // Silêncio proposital: o aviso continua na tela e a pessoa tenta de novo.
    }
    setEnviando(false)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm">
      <MailWarning className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-amber-900 dark:text-amber-200 flex-1 min-w-[16rem]">
        Confirme seu e-mail <strong>{email}</strong> — é o que garante recuperar a conta se você
        esquecer a senha. O link está na mensagem de boas-vindas.
      </p>
      {enviado ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Link reenviado
        </span>
      ) : (
        <button
          type="button"
          onClick={reenviar}
          disabled={enviando}
          className="font-semibold text-amber-800 dark:text-amber-300 underline disabled:opacity-60"
        >
          {enviando ? 'Enviando...' : 'Reenviar link'}
        </button>
      )}
    </div>
  )
}
