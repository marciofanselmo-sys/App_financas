'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { OverviewSection } from '@/components/ui/overview-blocks'
import { createClient } from '@/lib/supabase/client'
import { useAdminUsers, useCaktoEvents, useDbSize, useUsageByUser } from '@/hooks/use-admin-data'
import { usoPorCliente } from '@/lib/admin/usage'
import { pagaPelaCakto, tierDe } from '@/lib/admin/users'
import { precoDe } from '@/lib/plans'
import { LIMITES, METRICAS_MANUAIS, VERCEL_PLANO, formatValor, nivel, type LimiteKey } from '@/lib/admin/limits'
import { AlertTriangle, Database, Globe, Mail, CreditCard, Signpost, ExternalLink, Pencil } from 'lucide-react'
import { format, startOfMonth } from 'date-fns'
import { BarraLimite, Carregando } from './admin-ui'

const DIA = 24 * 60 * 60 * 1000
const GB = 1024 * 1024 * 1024
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Medida {
  key: LimiteKey
  usado: number | null
  fonte: string
  nota: string
  link?: string
  manual?: boolean
}

interface Manual { key: string; value: number; updated_at: string }

export function LimitsTab({ refreshKey }: { refreshKey: number }) {
  const users = useAdminUsers(refreshKey)
  const uso = useUsageByUser(refreshKey)
  const db = useDbSize(refreshKey)
  const eventos = useCaktoEvents(refreshKey)

  const [emails, setEmails] = useState<{ mes: number; maxDia: number; diaPico: string | null } | null>(null)
  const [emailsErro, setEmailsErro] = useState(false)
  const [manuais, setManuais] = useState<Record<string, Manual>>({})
  const [manuaisErro, setManuaisErro] = useState(false)
  const [editando, setEditando] = useState<LimiteKey | null>(null)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const [e, m] = await Promise.all([
      supabase.from('email_log').select('sent_at').eq('ok', true).gte('sent_at', startOfMonth(new Date()).toISOString()),
      supabase.from('admin_manual_metrics').select('key, value, updated_at'),
    ])
    setEmailsErro(!!e.error)
    if (!e.error) {
      const porDia = new Map<string, number>()
      for (const r of e.data) {
        const d = r.sent_at.slice(0, 10)
        porDia.set(d, (porDia.get(d) ?? 0) + 1)
      }
      const pico = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
      setEmails({ mes: e.data.length, maxDia: pico?.[1] ?? 0, diaPico: pico?.[0] ?? null })
    }
    setManuaisErro(!!m.error)
    if (!m.error) setManuais(Object.fromEntries(m.data.map(r => [r.key, { ...r, value: Number(r.value) }])))
  }, [])

  useEffect(() => { carregar() }, [carregar, refreshKey])

  async function salvarManual(key: LimiteKey, valor: number) {
    const { error } = await createClient().from('admin_manual_metrics')
      .upsert({ key, value: valor, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (!error) { setEditando(null); carregar() }
    return error?.message ?? null
  }

  const calc = useMemo(() => {
    const lista = users.data ?? []
    const agora = users.fetchedAt
    const mau = lista.filter(u => u.last_sign_in_at && agora - new Date(u.last_sign_in_at).getTime() <= 30 * DIA).length
    const cadastros30 = lista.filter(u => agora - new Date(u.created_at).getTime() <= 30 * DIA).length
    const clientes = usoPorCliente(lista, uso.data ?? [])
    const media = clientes.length ? clientes.reduce((s, c) => s + c.bytes, 0) / clientes.length : 0
    const mrr = lista.filter(pagaPelaCakto).reduce((s, u) => s + (precoDe(tierDe(u))?.porMes ?? 0), 0)
    return { mau, cadastros30, media, mrr }
  }, [users.data, users.fetchedAt, uso.data])

  if (users.loading || db.loading) return <Carregando />

  const tamanho = db.data
  const crescimento = calc.cadastros30 * calc.media // bytes por mês, pelo ritmo de cadastros
  const projecaoDb = tamanho == null ? 'rode migration_admin_paineis.sql'
    : crescimento <= 0 ? 'sem cadastros no último mês'
    : (() => {
        const meses = (LIMITES.supabaseDb.limite - tamanho) / crescimento
        return meses > 36 ? 'no ritmo atual: mais de 3 anos' : `no ritmo atual: ~${Math.max(Math.round(meses), 1)} meses`
      })()

  const manual = (key: LimiteKey): Medida => {
    const cfg = METRICAS_MANUAIS.find(m => m.key === key)!
    const reg = manuais[key]
    return {
      key, usado: reg ? reg.value : null, manual: true, link: cfg.url,
      fonte: `conferir no ${cfg.onde}`,
      nota: reg ? `informado em ${format(new Date(reg.updated_at), 'dd/MM')}` : 'ainda não informado',
    }
  }

  const supabase: Medida[] = [
    { key: 'supabaseDb', usado: tamanho, fonte: 'automático', nota: projecaoDb },
    manual('supabaseEgress'),
    { key: 'supabaseMau', usado: calc.mau, fonte: 'automático', nota: `${calc.cadastros30} cadastro${calc.cadastros30 !== 1 ? 's' : ''} no último mês` },
  ]
  const vercel: Medida[] = [manual('vercelTransfer'), manual('vercelFunctions')]
  const resend: Medida[] = [
    { key: 'resendMes', usado: emailsErro ? null : emails?.mes ?? null, fonte: 'automático (registro de envios)', nota: emailsErro ? 'rode migration_admin_paineis.sql' : 'desde o dia 1º' },
    { key: 'resendDia', usado: emailsErro ? null : emails?.maxDia ?? null, fonte: 'automático', nota: emails?.diaPico ? `pico em ${format(new Date(emails.diaPico + 'T12:00'), 'dd/MM')}` : '—' },
  ]

  const todas = [...supabase, ...vercel, ...resend]
  const criticas = todas.filter(m => m.usado != null && (m.usado / LIMITES[m.key].limite) * 100 >= 80)
  const ultimoEvento = eventos.data?.[0]

  return (
    <div className="space-y-6">
      {VERCEL_PLANO === 'hobby' && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-5 py-4">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-300">
            <b>Vercel Hobby não permite uso comercial.</b> O app cobra assinatura, então pelos termos da Vercel ele precisa estar no Pro (US$ 20/mês). Hoje funciona, mas a Vercel pode suspender o projeto.
          </p>
        </div>
      )}
      {manuaisErro && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Os números digitados à mão precisam de <code className="font-mono">migration_admin_paineis.sql</code> no Supabase.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Servico icon={Database} nome="Supabase" plano="Plano grátis" medidas={supabase}
          editando={editando} onEditar={setEditando} onSalvar={salvarManual} podeEditar={!manuaisErro}
          extra={<Rodape esq="Arquivos (storage)" dir="não usamos" />} />
        <Servico icon={Globe} nome="Vercel" plano={VERCEL_PLANO === 'hobby' ? 'Hobby (grátis)' : 'Pro'} medidas={vercel}
          editando={editando} onEditar={setEditando} onSalvar={salvarManual} podeEditar={!manuaisErro} />
        <Servico icon={Mail} nome="Resend (e-mails)" plano="Plano grátis" medidas={resend}
          editando={editando} onEditar={setEditando} onSalvar={salvarManual} podeEditar={false} />
        <OverviewSection icon={CreditCard} title="Cakto (pagamentos)" subtitle="sem mensalidade">
          <div className="mt-3 divide-y divide-dashed divide-slate-100 dark:divide-white/[0.06] text-sm">
            <Rodape esq="Limite de uso" dir="não tem" />
            <Rodape esq="Custo" dir="taxa por venda aprovada" />
            <Rodape esq="Webhook" dir={eventos.loading ? '…' : ultimoEvento
              ? <span className={ultimoEvento.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  ● {ultimoEvento.error ? 'último com erro' : 'recebendo'} · último {format(new Date(ultimoEvento.received_at), 'dd/MM HH:mm')}
                </span>
              : 'nenhum evento recebido ainda'} />
          </div>
        </OverviewSection>
      </div>

      <OverviewSection icon={Signpost} title="Quando mudar" subtitle="os gatilhos para trocar de plano ou de plataforma">
        <div className="mt-3 divide-y divide-dashed divide-slate-100 dark:divide-white/[0.06] text-sm">
          {VERCEL_PLANO === 'hobby' && (
            <Gatilho tag="Agora" cls="verde" texto="Vercel: passar para o Pro por causa da regra de uso comercial" hoje="independe de tamanho" />
          )}
          <Gatilho tag="Gatilho" cls="amarelo" texto="Qualquer barra acima de 80% por 2 meses seguidos → subir o plano daquele serviço"
            hoje={criticas.length ? `hoje: ${criticas.map(m => LIMITES[m.key].label).join(', ')}` : 'hoje: nenhuma'} />
          <Gatilho tag="Gatilho" cls="amarelo" texto="Banco acima de 400 MB → rever a janela de histórico ou subir o plano do Supabase"
            hoje={tamanho != null ? `hoje: ${formatValor('supabaseDb', tamanho)}` : '—'} />
          <Gatilho tag="Plataforma" cls="cinza" texto="Trocar de plataforma só faz sentido se o custo mensal passar de ~10% da receita"
            hoje={`hoje: custo R$ 0 · receita ${brl(calc.mrr)}/mês`} />
        </div>
      </OverviewSection>
    </div>
  )
}

function Servico({ icon, nome, plano, medidas, extra, editando, onEditar, onSalvar, podeEditar }: {
  icon: typeof Database; nome: string; plano: string; medidas: Medida[]; extra?: React.ReactNode
  editando: LimiteKey | null; onEditar: (k: LimiteKey | null) => void
  onSalvar: (k: LimiteKey, v: number) => Promise<string | null>; podeEditar: boolean
}) {
  return (
    <OverviewSection icon={icon} title={nome} subtitle={plano}>
      <div className="mt-4 space-y-4">
        {medidas.map(m => {
          const lim = LIMITES[m.key]
          const pct = m.usado != null ? (m.usado / lim.limite) * 100 : 0
          const cor = m.usado == null ? 'text-slate-400' : { ok: '', atencao: 'text-amber-600 dark:text-amber-400', critico: 'text-red-600 dark:text-red-400' }[nivel(pct)]
          return (
            <div key={m.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                <span className="text-slate-600 dark:text-slate-300">{lim.label}</span>
                <span className="whitespace-nowrap">
                  <b className={cor}>{m.usado != null ? formatValor(m.key, m.usado) : '—'}</b>
                  <span className="text-xs text-slate-400"> de {formatValor(m.key, lim.limite)}</span>
                </span>
              </div>
              <BarraLimite pct={m.usado != null ? pct : 0} cor={m.usado == null ? 'bg-slate-200 dark:bg-white/10' : undefined} />
              <div className="flex items-center justify-between gap-3 mt-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  {m.link
                    ? <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-blue-600">{m.fonte} <ExternalLink className="h-3 w-3" /></a>
                    : m.fonte}
                  {m.manual && podeEditar && editando !== m.key && (
                    <button type="button" onClick={() => onEditar(m.key)} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                      <Pencil className="h-3 w-3" /> informar
                    </button>
                  )}
                </span>
                <span>{m.nota}</span>
              </div>
              {editando === m.key && <EditarManual medida={m} onCancelar={() => onEditar(null)} onSalvar={v => onSalvar(m.key, v)} />}
            </div>
          )
        })}
        {extra && <div className="text-sm">{extra}</div>}
      </div>
    </OverviewSection>
  )
}

/** Valor copiado do painel do serviço: em GB para tráfego, número para execuções. */
function EditarManual({ medida, onCancelar, onSalvar }: {
  medida: Medida; onCancelar: () => void; onSalvar: (v: number) => Promise<string | null>
}) {
  const emGb = LIMITES[medida.key].unidade === 'bytes'
  const [texto, setTexto] = useState(medida.usado != null ? String(emGb ? +(medida.usado / GB).toFixed(2) : medida.usado).replace('.', ',') : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const v = Number(texto.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(v) || v < 0) { setErro('Valor inválido'); return }
    setSalvando(true)
    const e = await onSalvar(emGb ? v * GB : v)
    setSalvando(false)
    setErro(e)
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvar()}
        inputMode="decimal" placeholder={emGb ? 'ex.: 1,2' : 'ex.: 41000'}
        className="h-8 w-32 px-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-blue-400" />
      <span className="text-xs text-slate-400">{emGb ? 'GB' : 'execuções'}</span>
      <button type="button" onClick={salvar} disabled={salvando} className="h-8 px-3 text-xs rounded-lg bg-blue-600 text-white disabled:opacity-60">Salvar</button>
      <button type="button" onClick={onCancelar} className="h-8 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500">Cancelar</button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  )
}

function Rodape({ esq, dir }: { esq: React.ReactNode; dir: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-slate-600 dark:text-slate-300">{esq}</span>
      <span className="text-slate-500 dark:text-slate-400 text-right">{dir}</span>
    </div>
  )
}

const GATILHO_CLS = {
  verde:   'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-300',
  amarelo: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300',
  cinza:   'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300',
}

function Gatilho({ tag, cls, texto, hoje }: { tag: string; cls: keyof typeof GATILHO_CLS; texto: string; hoje: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 py-2.5">
      <span className="text-slate-700 dark:text-slate-200">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border mr-2 ${GATILHO_CLS[cls]}`}>{tag}</span>
        {texto}
      </span>
      <span className="text-xs text-slate-400 shrink-0">{hoje}</span>
    </div>
  )
}
