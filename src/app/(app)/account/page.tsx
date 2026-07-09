'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User, Lock, AlertTriangle, CheckCircle, Eye, EyeOff,
  Mail, Shield, Trash2,
} from 'lucide-react'

type Tab = 'perfil' | 'senha' | 'conta'

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
      ok
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700/50'
        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
    }`}>
      {ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      {msg}
    </div>
  )
}

// ── Tab: Perfil ──────────────────────────────────────────────────────────────
function TabPerfil() {
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
      setName(data.user?.user_metadata?.full_name ?? '')
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const { error } = await createClient().auth.updateUser({
      data: { full_name: name.trim() },
    })
    setMsg(error
      ? { ok: false, text: 'Erro ao salvar. Tente novamente.' }
      : { ok: true,  text: 'Nome atualizado com sucesso.' }
    )
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Nome de exibição</Label>
        <Input
          id="name"
          placeholder="Seu nome completo"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">Aparece no diagnóstico e nos relatórios.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email-display">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="email-display"
            value={email}
            readOnly
            disabled
            className="pl-9 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed"
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">Para alterar o e-mail entre em contato com o suporte.</p>
      </div>

      {msg && <StatusMsg ok={msg.ok} msg={msg.text} />}

      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  )
}

// ── Tab: Senha ───────────────────────────────────────────────────────────────
function TabSenha() {
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (newPass.length < 6) {
      setMsg({ ok: false, text: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    if (newPass !== confirmPass) {
      setMsg({ ok: false, text: 'As senhas não coincidem.' })
      return
    }

    setSaving(true)
    const { error } = await createClient().auth.updateUser({ password: newPass })
    if (error) {
      setMsg({ ok: false, text: 'Erro ao alterar a senha. Tente novamente.' })
    } else {
      setMsg({ ok: true, text: 'Senha alterada com sucesso.' })
      setNewPass('')
      setConfirmPass('')
    }
    setSaving(false)
  }

  const strength = newPass.length === 0 ? null
    : newPass.length < 6  ? { label: 'Fraca',   color: 'bg-red-500',    w: 'w-1/4' }
    : newPass.length < 10 ? { label: 'Média',   color: 'bg-amber-500',  w: 'w-2/4' }
    : newPass.length < 14 ? { label: 'Forte',   color: 'bg-emerald-500',w: 'w-3/4' }
    :                        { label: 'Excelente',color:'bg-blue-500',   w: 'w-full' }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="new-pass">Nova senha</Label>
        <div className="relative">
          <Input
            id="new-pass"
            type={showNew ? 'text' : 'password'}
            placeholder="Mínimo 6 caracteres"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            required
            className="pr-10"
          />
          <button type="button" onClick={() => setShowNew(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {strength && (
          <div className="space-y-1">
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${strength.color} ${strength.w}`} />
            </div>
            <p className={`text-xs font-medium ${
              strength.label === 'Fraca' ? 'text-red-500'
              : strength.label === 'Média' ? 'text-amber-500'
              : strength.label === 'Forte' ? 'text-emerald-600'
              : 'text-blue-500'
            }`}>{strength.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
        <div className="relative">
          <Input
            id="confirm-pass"
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repita a nova senha"
            value={confirmPass}
            onChange={e => setConfirmPass(e.target.value)}
            required
            className="pr-10"
          />
          <button type="button" onClick={() => setShowConfirm(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPass && newPass !== confirmPass && (
          <p className="text-xs text-red-500">As senhas não coincidem.</p>
        )}
        {confirmPass && newPass === confirmPass && newPass.length >= 6 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> As senhas coincidem.
          </p>
        )}
      </div>

      {msg && <StatusMsg ok={msg.ok} msg={msg.text} />}

      <Button type="submit" disabled={saving}>
        {saving ? 'Alterando...' : 'Alterar senha'}
      </Button>
    </form>
  )
}

// ── Tab: Conta (danger zone) ─────────────────────────────────────────────────
function TabConta() {
  const router = useRouter()
  const [confirm, setConfirm]   = useState('')
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null)
  const CONFIRM_WORD = 'EXCLUIR'

  async function handleDelete() {
    if (confirm !== CONFIRM_WORD) return
    setDeleting(true)
    setMsg(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleting(false); return }

    // Apaga todos os dados do usuário nas tabelas. Lista corrigida em 2026-07-08:
    // 'planning' era o nome de uma tabela que nunca existiu (a real é
    // 'budget_plans') — o planejamento nunca era apagado ao excluir a conta.
    // Também faltavam transaction_boards, categorization_rules,
    // recurring_groups e recurring_decisions.
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', user.id),
      supabase.from('goals').delete().eq('user_id', user.id),
      supabase.from('categories').delete().eq('user_id', user.id),
      supabase.from('budget_plans').delete().eq('user_id', user.id),
      supabase.from('transaction_boards').delete().eq('user_id', user.id),
      supabase.from('categorization_rules').delete().eq('user_id', user.id),
      supabase.from('recurring_groups').delete().eq('user_id', user.id),
      supabase.from('recurring_decisions').delete().eq('user_id', user.id),
    ])

    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Informações da conta */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-400" /> Informações da sessão
        </h3>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Provedor</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">E-mail e senha</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Status</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 dark:border-red-800/60 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <h3 className="font-semibold text-red-600 dark:text-red-400">Excluir minha conta</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Todos os seus dados serão permanentemente excluídos: transações, metas, categorias e planejamento. Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-delete" className="text-sm text-slate-600 dark:text-slate-400">
            Digite <strong className="text-slate-700 dark:text-slate-200 font-mono">{CONFIRM_WORD}</strong> para confirmar:
          </Label>
          <Input
            id="confirm-delete"
            placeholder={CONFIRM_WORD}
            value={confirm}
            onChange={e => setConfirm(e.target.value.toUpperCase())}
            className="border-red-200 dark:border-red-800/60 focus-visible:ring-red-400"
          />
        </div>

        {msg && <StatusMsg ok={msg.ok} msg={msg.text} />}

        <Button
          variant="destructive"
          disabled={confirm !== CONFIRM_WORD || deleting}
          onClick={handleDelete}
          className="w-full gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Excluindo...' : 'Excluir conta permanentemente'}
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'perfil', label: 'Perfil',    icon: User          },
  { id: 'senha',  label: 'Senha',     icon: Lock          },
  { id: 'conta',  label: 'Conta',     icon: AlertTriangle },
]

export default function AccountPage() {
  const [tab, setTab] = useState<Tab>('perfil')

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Minha conta</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie suas informações e preferências de segurança</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white dark:bg-[#111c2d] text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-white/[0.06]">
        {tab === 'perfil' && <TabPerfil />}
        {tab === 'senha'  && <TabSenha />}
        {tab === 'conta'  && <TabConta />}
      </div>
    </div>
  )
}
