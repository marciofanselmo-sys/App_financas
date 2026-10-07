'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { PAID_TIERS, PLANS, PaidTier, moeda, precoDe } from '@/lib/plans'
import { TRIAL_BASE_DAYS, trialEndsAt } from '@/lib/trial-config'
import { useSubscription, checkoutUrl } from '@/hooks/use-subscription'
import { refreshTrial, useTrial } from '@/hooks/use-trial'
import { escolherContaAtiva } from '@/hooks/use-conta-ativa'
import { cn } from '@/lib/utils'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

interface Construido {
  nome?: string
  contas: { id: string; name: string; created_at: string }[]
  lancamentos: number
  regras: number
  fixos: number
  plano: { month: number; year: number; expected_income: number } | null
  meta: { name: string; current_amount: number; target_amount: number } | null
  metas: number
}

async function buscarConstruido(): Promise<Construido> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const conta = async (t: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = sb.from(t).select('id', { count: 'exact', head: true })
    if (f) q = f(q)
    const { count } = await q
    return count ?? 0
  }
  const [contas, lancamentos, regras, fixos, plano, metas] = await Promise.all([
    sb.from('transaction_boards').select('id, name, created_at').order('created_at').then(r => r.data ?? []),
    conta('transactions'),
    conta('categorization_rules'),
    conta('recurring_decisions', q => q.eq('decision', 'confirmed')),
    sb.from('budget_plans').select('month, year, expected_income').gt('expected_income', 0)
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(1).then(r => r.data?.[0] ?? null),
    sb.from('goals').select('name, current_amount, target_amount').order('created_at').then(r => r.data ?? []),
  ])
  const full = (user?.user_metadata?.full_name as string | undefined)?.trim()
  return {
    nome: full ? full.split(/\s+/)[0] : undefined,
    contas, lancamentos, regras, fixos, plano,
    meta: metas[0] ?? null, metas: metas.length,
  }
}

/**
 * Fim do teste: "Olha o que você construiu". Aparece uma vez, quando o
 * relógio zera e a pessoa não assinou. Mostra o que ela montou, o que
 * continua no Grátis e o que fica só para consulta, e os planos. Quem segue
 * no Grátis com mais de uma conta escolhe aqui qual fica ativa.
 */
export function TrialEndModal() {
  const { trial } = useTrial()
  const { isPro, inTrial, loading, userId } = useSubscription()
  const deveMostrar = !loading && !!trial && !inTrial && !isPro && !trial.ended_seen_at
  const [dados, setDados] = useState<Construido | null>(null)
  const [passo, setPasso] = useState<'resumo' | 'conta'>('resumo')
  const [escolha, setEscolha] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [fechado, setFechado] = useState(false)

  useEffect(() => {
    if (deveMostrar && !dados) void buscarConstruido().then(d => { setDados(d); setEscolha(d.contas[0]?.id ?? null) })
  }, [deveMostrar, dados])

  if (!deveMostrar || !dados || fechado) return null

  const marcarVisto = async () => {
    await fetch('/api/teste/fim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visto: true }) }).catch(() => null)
    await refreshTrial()
  }
  const continuarGratis = async () => {
    if (dados.contas.length > (PLANS.free.maxBoards ?? 1)) { setPasso('conta'); return }
    setFechado(true)
    await marcarVisto()
  }
  const confirmarConta = async () => {
    if (!escolha) return
    setSalvando(true)
    const e = await escolherContaAtiva(escolha)
    setSalvando(false)
    if (e) { setErro(e); return }
    setFechado(true)
    await marcarVisto()
  }

  const horas = TRIAL_BASE_DAYS * 24 + (trial?.bonus_hours ?? 0)
  const duracao = `${Math.floor(horas / 24)} dias${horas % 24 ? ` e ${horas % 24} horas` : ''}`
  const terminou = trial ? trialEndsAt(trial) : null

  const itens: { icone: string; texto: React.ReactNode; fica: 'continua' | 'consulta'; nota: string }[] = []
  if (dados.contas.length > 0) itens.push({
    icone: '✅', fica: 'continua',
    texto: <><b>{dados.contas.length} conta{dados.contas.length > 1 ? 's' : ''} organizada{dados.contas.length > 1 ? 's' : ''}</b> · {dados.lancamentos} lançamentos</>,
    nota: dados.contas.length > 1 ? 'continua · 1 conta ativa' : 'continua no Grátis',
  })
  if (dados.regras > 0) itens.push({ icone: '⚡', fica: 'continua', texto: <><b>{dados.regras} regras automáticas</b> categorizando suas importações</>, nota: 'continuam funcionando' })
  if (dados.fixos > 0) itens.push({ icone: '📅', fica: 'consulta', texto: <><b>{dados.fixos} gasto{dados.fixos > 1 ? 's' : ''} fixo{dados.fixos > 1 ? 's' : ''} confirmado{dados.fixos > 1 ? 's' : ''}</b></>, nota: 'só consulta' })
  if (dados.plano) itens.push({ icone: '🎯', fica: 'consulta', texto: <><b>Planejamento de {MESES[dados.plano.month - 1]}</b> · renda de {moeda(Number(dados.plano.expected_income))}</>, nota: 'só consulta' })
  if (dados.meta) {
    const pct = Number(dados.meta.target_amount) > 0 ? Math.round((Number(dados.meta.current_amount) / Number(dados.meta.target_amount)) * 100) : 0
    itens.push({ icone: '🏁', fica: 'consulta', texto: <><b>Meta “{dados.meta.name}”</b> · {pct}% de {moeda(Number(dados.meta.target_amount))}{dados.metas > 1 ? ` (+${dados.metas - 1})` : ''}</>, nota: 'só consulta' })
  }

  return (
    <Dialog open onOpenChange={() => { /* fecha só pelos botões */ }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[92vh] overflow-y-auto" showCloseButton={false}>
        {passo === 'resumo' ? (
          <>
            <div className="nobli-gradient text-white px-6 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Seu teste de {duracao} terminou{terminou ? ` em ${terminou.toLocaleDateString('pt-BR')}` : ''}</p>
              <DialogTitle className="text-xl sm:text-2xl font-extrabold mt-1">
                {itens.length > 0 ? `${dados.nome ? `${dados.nome}, olha` : 'Olha'} o que você construiu` : `${dados.nome ? `${dados.nome}, seu` : 'Seu'} teste terminou`}
              </DialogTitle>
              <p className="text-sm opacity-85 mt-0.5">Nada foi apagado. Assine para continuar usando tudo isso.</p>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-4">
              {itens.length > 0 && (
                <div className="space-y-2">
                  {itens.map((it, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-[#DDE7F3] dark:border-white/[0.08] px-3 py-2.5 text-sm">
                      <span>{it.icone}</span>
                      <span className="flex-1 min-w-0 text-slate-700 dark:text-slate-200">{it.texto}</span>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        it.fica === 'continua' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300')}>
                        {it.nota}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[#0B2D6B] dark:text-slate-100">Continue de onde parou</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PAID_TIERS.map((t: PaidTier) => {
                    const p = precoDe(t)!
                    const melhor = t === 'anual'
                    return (
                      <a key={t} href={checkoutUrl(userId, 'app_fim_teste', t)} target="_blank" rel="noopener noreferrer"
                        className={cn('rounded-xl border p-3 text-center hover:border-blue-400',
                          melhor ? 'border-2 border-blue-600 bg-blue-50 dark:bg-blue-500/10' : 'border-[#DDE7F3] dark:border-white/[0.08]')}>
                        <p className={cn('text-xs', melhor ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-500')}>{PLANS[t].label}{melhor ? ' · mais escolhido' : ''}</p>
                        <p className="text-lg font-extrabold text-[#0B2D6B] dark:text-slate-100 tabular-nums">{moeda(p.total)}</p>
                        <p className="text-[11px] text-slate-500">{t === 'mensal' ? 'por mês' : `${moeda(p.porMes)}/mês`}</p>
                      </a>
                    )
                  })}
                </div>
              </div>
              <a href={checkoutUrl(userId, 'app_fim_teste', 'anual')} target="_blank" rel="noopener noreferrer"
                className="block w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-center py-3 font-bold">
                Assinar o Anual e manter tudo
              </a>
              <button type="button" onClick={continuarGratis} className="block w-full text-center text-sm text-slate-500 hover:underline">
                Continuar no Grátis
              </button>
            </div>
          </>
        ) : (
          <div className="px-6 py-6 space-y-4">
            <DialogTitle className="text-lg font-extrabold text-[#0B2D6B] dark:text-slate-100">Qual conta fica ativa?</DialogTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No Grátis, todas as suas contas continuam aparecendo, mas só uma fica ativa para importar e editar. As outras ficam para consulta. Você pode trocar depois em Contas e Cartões.
            </p>
            <div className="space-y-2">
              {dados.contas.map(c => (
                <button key={c.id} type="button" onClick={() => setEscolha(c.id)}
                  className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm text-left',
                    escolha === c.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/10' : 'border-[#DDE7F3] dark:border-white/[0.08]')}>
                  <span className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    escolha === c.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300')}>
                    {escolha === c.id && <Check className="h-3 w-3" />}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.name}</span>
                </button>
              ))}
            </div>
            {erro && (
              <p className="text-sm text-red-600">
                {erro}{' '}
                <button type="button" className="underline" onClick={() => { setFechado(true); void marcarVisto() }}>Seguir com a mais antiga</button>
              </p>
            )}
            <button type="button" disabled={!escolha || salvando} onClick={confirmarConta}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 font-bold">
              {salvando ? 'Salvando…' : 'Deixar esta conta ativa'}
            </button>
            <button type="button" onClick={() => setPasso('resumo')} className="block w-full text-center text-sm text-slate-500 hover:underline">
              Voltar e ver os planos
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
