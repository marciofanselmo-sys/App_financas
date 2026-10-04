'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthFormShell } from '@/components/auth/auth-form-shell'
import { ShieldCheck, Loader2 } from 'lucide-react'

/**
 * Primeiro acesso de quem comprou pelo anúncio: a conta foi criada pelo
 * webhook da Cakto e o cliente chegou aqui por um link de uso único, já com
 * sessão. Ele define a senha e só então entra no app.
 *
 * Nenhuma senha é enviada por e-mail — o link do convite é que autentica.
 */
export default function PrimeiroAcessoPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      // Sem sessão, o link expirou ou já foi usado: o caminho é o "esqueci
      // minha senha" do login, não ficar preso numa tela em branco.
      if (!user) {
        router.replace('/auth/login?erro=link-expirado')
        return
      }
      setEmail(user.email ?? '')
      setChecking(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('A senha precisa de pelo menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As duas senhas não são iguais.'); return }

    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      // "Tente de novo" escondia o motivo real e deixava a pessoa repetindo a
      // mesma coisa. Os dois casos comuns têm saídas diferentes: senha igual à
      // atual se resolve escolhendo outra; sessão perdida só se resolve com um
      // link novo.
      const motivo = updateError.message.toLowerCase()
      if (motivo.includes('different from the old') || motivo.includes('should be different')) {
        setError('Escolha uma senha diferente da que você já usa nesta conta.')
      } else if (motivo.includes('session') || motivo.includes('jwt') || motivo.includes('token')) {
        setError('Seu link de acesso expirou. Peça outro em "Esqueci minha senha" na tela de entrada.')
      } else if (motivo.includes('weak') || motivo.includes('password')) {
        setError('Essa senha é fraca demais. Use pelo menos 8 caracteres, misturando letras e números.')
      } else {
        setError(`Não foi possível salvar a senha: ${updateError.message}`)
      }
      setSaving(false)
      return
    }

    // Tira a marca de primeiro acesso. Se falhar, não trava o cliente: ele
    // já tem senha, e a marca só controla o aviso na tela.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ needs_password: false }).eq('user_id', user.id)
    }

    // Navegação dura, não `router.replace`: o cookie da sessão é gravado pelo
    // cliente do Supabase e a navegação do Next pode acontecer antes de ele
    // estar disponível para o middleware — que então não vê sessão nenhuma e
    // devolve a pessoa para o login, logo depois de ela criar a senha.
    window.location.assign('/dashboard')
  }

  if (checking) {
    return (
      <AuthFormShell>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </AuthFormShell>
    )
  }

  return (
    <AuthFormShell>
      <div className="space-y-2 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight text-[#0B2D6B] dark:text-slate-100">
          Bem-vindo ao NOBLI
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sua assinatura está ativa. Crie a sua senha para começar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={email} disabled readOnly />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha" type="password" autoComplete="new-password" autoFocus required
            placeholder="Pelo menos 8 caracteres"
            value={password} onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirma-senha">Confirme a senha</Label>
          <Input
            id="confirma-senha" type="password" autoComplete="new-password" required
            value={confirm} onChange={e => setConfirm(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Salvando...' : 'Criar senha e entrar'}
        </Button>

        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          Depois de entrar, cadastre suas contas e importe o extrato do seu banco.
        </p>
      </form>
    </AuthFormShell>
  )
}
