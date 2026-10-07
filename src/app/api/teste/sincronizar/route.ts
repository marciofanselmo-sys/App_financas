import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRIAL_TASKS, TrialTaskId, TRIAL_TASK_BY_ID } from '@/lib/trial-tasks'
import { TRIAL_MAX_BONUS_HOURS, trialEndsAt } from '@/lib/trial-config'

/**
 * Confere a jornada do teste nos dados reais da conta e soma as horas.
 *
 * Regras: cada tarefa vale uma vez; só ganha hora quem conclui com o relógio
 * rodando; o bônus nunca passa de 48h. Tudo isso no servidor — o navegador só
 * pergunta "o que já fiz?" e recebe a resposta.
 */
export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const admin = createAdminClient()
  const uid = user.id
  const conta = async (tabela: string, filtro: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count } = await filtro(admin.from(tabela).select('*', { count: 'exact', head: true }).eq('user_id', uid))
    return count ?? 0
  }

  const { data: trial } = await admin.from('user_trials').select('base_ends_at, bonus_hours').eq('user_id', uid).maybeSingle()
  const { data: eventos } = await admin.from('product_events').select('event, dedupe_key').eq('user_id', uid)
  const ev = eventos ?? []
  const tem = (e: string) => ev.some(x => x.event === e)
  const registradas = new Set(ev.filter(x => x.event === 'tarefa').map(x => x.dedupe_key as TrialTaskId))

  const { data: boards } = await admin.from('transaction_boards').select('id').eq('user_id', uid).eq('is_investment', false)
  const boardIds = (boards ?? []).map(b => b.id as string)
  let contasComLancamento = 0
  for (const id of boardIds.slice(0, 10)) {
    if (await conta('transactions', q => q.eq('board_id', id).limit(1)) > 0) contasComLancamento++
  }

  const feito: Record<TrialTaskId, boolean> = {
    conta: boardIds.length >= 1,
    importar: tem('primeira_importacao'),
    categorias: await conta('categorization_rules', q => q.or('action.is.null,action.neq.internal')) >= 3,
    resumo: tem('resumo_visto'),
    fixos: await conta('recurring_decisions', q => q.eq('decision', 'confirmed')) >= 1,
    planejamento: await conta('budget_plans', q => q.gt('expected_income', 0)) >= 1,
    meta: await conta('goals', q => q) >= 1,
    segunda_conta: contasComLancamento >= 2,
    entre_contas: (await conta('categorization_rules', q => q.eq('action', 'internal'))) >= 1
      || (await conta('transactions', q => q.eq('is_internal', true))) >= 1,
    voltar: new Set(ev.filter(x => x.event === 'visita').map(x => x.dedupe_key)).size >= 2,
  }

  const ativo = !!trial && trialEndsAt(trial).getTime() > Date.now()
  const novas: TrialTaskId[] = []
  if (ativo) {
    for (const t of TRIAL_TASKS) {
      if (feito[t.id] && !registradas.has(t.id)) novas.push(t.id)
    }
    if (novas.length > 0) {
      await admin.from('product_events').upsert(
        novas.map(id => ({ user_id: uid, event: 'tarefa', dedupe_key: id, props: { horas: TRIAL_TASK_BY_ID[id].horas } })),
        { onConflict: 'user_id,event,dedupe_key', ignoreDuplicates: true },
      )
      novas.forEach(id => registradas.add(id))
      const bonus = Math.min(TRIAL_MAX_BONUS_HOURS, [...registradas].reduce((s, id) => s + (TRIAL_TASK_BY_ID[id]?.horas ?? 0), 0))
      await admin.from('user_trials').update({ bonus_hours: bonus }).eq('user_id', uid)
    }
  }

  return NextResponse.json({
    ok: true,
    ativo,
    // O que conta na lista: tarefa registrada (ganhou hora) ou feita agora.
    feitas: TRIAL_TASKS.filter(t => registradas.has(t.id) || feito[t.id]).map(t => t.id),
    novas: novas.map(id => ({ id, horas: TRIAL_TASK_BY_ID[id].horas })),
  })
}
