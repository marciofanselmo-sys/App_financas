'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PLANS, PAID_TIERS, PlanTier } from '@/lib/plans'
import type { AdminUser } from '@/lib/admin/types'
import { tierDe, pagaPelaCakto } from '@/lib/admin/users'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Users, Loader2, Search, ShieldCheck, Shield, Gift, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Pendente =
  | { tipo: 'role'; user: AdminUser; role: 'admin' | 'user' }
  | { tipo: 'plan'; user: AdminUser; plan: PlanTier }

const TIERS: PlanTier[] = ['free', ...PAID_TIERS]

function dataCurta(iso: string | null) {
  return iso ? format(new Date(iso), 'dd/MM/yy', { locale: ptBR }) : '—'
}

export function UsersPanel({ enabled }: { enabled: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [planoFiltro, setPlanoFiltro] = useState<PlanTier | null>(null)
  const [pendente, setPendente] = useState<Pendente | null>(null)
  const [salvando, setSalvando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErro(null)
    const res = await fetch('/api/admin/users', { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setErro(body.error ?? 'Não foi possível carregar os usuários.')
    } else {
      setUsers(body.users)
      setMe(body.me)
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (enabled) load() }, [enabled, load])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return users.filter(u =>
      (!planoFiltro || tierDe(u) === planoFiltro) &&
      (!q || u.email.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q)))
  }, [users, busca, planoFiltro])

  // Quantos em cada plano — e, nos pagos, quantos pagam de fato (Cakto) e
  // quantos estão de cortesia, que não entram na receita.
  const porPlano = useMemo(() => TIERS.map(tier => {
    const doPlano = users.filter(u => tierDe(u) === tier)
    return {
      tier,
      total: doPlano.length,
      pagos: doPlano.filter(pagaPelaCakto).length,
      cortesias: doPlano.filter(u => u.subscription?.provider === 'manual').length,
    }
  }), [users])

  const resumo = useMemo(() => ({
    admins: users.filter(u => u.role === 'admin').length,
    pagantes: users.filter(pagaPelaCakto).length,
    cortesias: users.filter(u => u.subscription?.provider === 'manual' && tierDe(u) !== 'free').length,
  }), [users])

  async function confirmar() {
    if (!pendente) return
    setSalvando(true)
    setErro(null)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        pendente.tipo === 'role'
          ? { userId: pendente.user.id, role: pendente.role }
          : { userId: pendente.user.id, plan: pendente.plan },
      ),
    })
    const body = await res.json().catch(() => ({}))
    setSalvando(false)
    setPendente(null)
    if (!res.ok) {
      setErro(body.error ?? 'Não foi possível salvar.')
      return
    }
    await load()
  }

  if (!enabled) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Usuários</h2>
          <span className="text-xs text-slate-400">
            ({users.length}) · {resumo.admins} admin{resumo.admins !== 1 ? 's' : ''} · {resumo.pagantes} pagante{resumo.pagantes !== 1 ? 's' : ''} · {resumo.cortesias} cortesia{resumo.cortesias !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="sm:ml-auto relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por e-mail ou nome"
            className="h-8 w-full sm:w-64 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 pt-4">
        {porPlano.map(({ tier, total, pagos, cortesias }) => {
          const ativo = planoFiltro === tier
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setPlanoFiltro(ativo ? null : tier)}
              aria-pressed={ativo}
              title={ativo ? 'Mostrar todos os planos' : `Mostrar só o plano ${PLANS[tier].label}`}
              className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                ativo
                  ? 'bg-blue-50 border-blue-300 dark:bg-blue-500/15 dark:border-blue-500/40'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
              }`}
            >
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{PLANS[tier].label}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{total}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {tier === 'free'
                  ? `${users.length ? Math.round((total / users.length) * 100) : 0}% das contas`
                  : `${pagos} pago${pagos !== 1 ? 's' : ''} · ${cortesias} cortesia${cortesias !== 1 ? 's' : ''}`}
              </p>
            </button>
          )
        })}
      </div>

      {erro && (
        <p className="mx-5 mt-4 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="px-5 py-3 font-medium">Usuário</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">Cadastro</th>
                <th className="px-5 py-3 font-medium whitespace-nowrap">Último acesso</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 font-medium">Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtrados.map(u => {
                const tier = tierDe(u)
                const cakto = pagaPelaCakto(u)
                const cortesia = u.subscription?.provider === 'manual' && tier !== 'free'
                const souEu = u.id === me
                return (
                  <tr key={u.id} className="align-middle">
                    <td className="px-5 py-3 max-w-[240px]">
                      <p className="text-slate-700 dark:text-slate-200 font-medium truncate">
                        {u.full_name || u.email.split('@')[0]}
                        {souEu && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">(você)</span>}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{dataCurta(u.created_at)}</td>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">{dataCurta(u.last_sign_in_at)}</td>
                    <td className="px-5 py-3 min-w-[150px]">
                      <Select
                        value={tier}
                        onValueChange={v => { if (v !== tier) setPendente({ tipo: 'plan', user: u, plan: v as PlanTier }) }}
                        disabled={cakto}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>{PLANS[tier].label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TIERS.map(t => (
                            <SelectItem key={t} value={t}>{PLANS[t].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cakto && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300">
                          <CreditCard className="h-3 w-3" /> Pago · Cakto
                        </span>
                      )}
                      {cortesia && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300">
                          <Gift className="h-3 w-3" /> Cortesia
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {u.role === 'admin' ? (
                        <button
                          type="button"
                          disabled={souEu}
                          title={souEu ? 'Você não pode tirar o seu próprio acesso' : 'Tirar acesso de admin'}
                          onClick={() => setPendente({ tipo: 'role', user: u, role: 'user' })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-300 enabled:hover:bg-violet-100 disabled:cursor-default"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPendente({ tipo: 'role', user: u, role: 'admin' })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-slate-700"
                        >
                          <Shield className="h-3.5 w-3.5" /> Tornar admin
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!pendente} onOpenChange={open => { if (!open && !salvando) setPendente(null) }}>
        <DialogContent>
          {pendente && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {pendente.tipo === 'role'
                    ? pendente.role === 'admin' ? 'Tornar admin?' : 'Tirar acesso de admin?'
                    : pendente.plan === 'free' ? 'Voltar para o plano Grátis?' : `Dar o plano ${PLANS[pendente.plan].label}?`}
                </DialogTitle>
                <DialogDescription>
                  <strong>{pendente.user.email}</strong>
                  {pendente.tipo === 'role'
                    ? pendente.role === 'admin'
                      ? ' passa a ver o Painel Admin inteiro: acessos, erros e dados de todos os usuários, e pode mudar planos e papéis.'
                      : ' deixa de ver o Painel Admin.'
                    : pendente.plan === 'free'
                      ? ' perde os recursos pagos na hora. Os dados dele continuam intactos.'
                      : ' recebe o plano como cortesia, sem cobrança e sem data para acabar — vale até você mudar aqui. Se ele assinar pela Cakto depois, o pagamento substitui a cortesia.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPendente(null)} disabled={salvando}>Cancelar</Button>
                <Button onClick={confirmar} disabled={salvando}>
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
