'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logSafeError } from '@/lib/supabase-error'
import { todayISO } from '@/utils/local-date'
import { findLateCredits, findPairSuggestions, isCreditCardBoard, PairSuggestion, SuggestionRule, SuggestionTx } from '@/lib/data-suggestions'
import { useTransactionBoards } from '@/hooks/use-transaction-boards'
import { applyInternalRule, undoInternalChanges, InternalUndo, PairSides, useRules } from '@/hooks/use-rules'

/** O que foi aplicado, com o necessário para desfazer. */
export interface AppliedAdjustment {
  keyword: string
  originBoardId: string
  targetBoardId: string
  marked: number
  paired: number
  legs: number
  restored?: number
  sides?: PairSides
  appliedAt: string
  rule:
    | { kind: 'created'; id: string }
    | { kind: 'updated'; id: string; prev: { scope_board_id: string | null; target_board_id: string | null; active: boolean; require_pair: boolean; pair_sides: PairSides } }
  tx: InternalUndo
}

type Decision =
  | { key: string; status: 'snoozed'; until: string }
  | { key: string; status: 'dismissed' }
  | { key: string; status: 'applied'; undo: AppliedAdjustment }

const SNOOZE_DAYS = 30
const LOCAL_KEY = 'nobli.adjustment_decisions'

// Sem a tabela adjustment_decisions (migração não rodada) as decisões ficam
// neste navegador — a tela funciona, só não acompanha o usuário entre aparelhos.
function readLocal(): Decision[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Decision[] } catch { return [] }
}
function writeLocal(list: Decision[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)) } catch { /* modo privado */ }
}
const tableMissing = (code?: string) => code === '42P01' || code === 'PGRST205'

/**
 * Ajustes sugeridos: cruza todos os lançamentos, propõe correções e aplica ou
 * desfaz cada uma. Aplicar = criar (ou completar) a regra "Entre minhas
 * contas" e rodar ela no histórico; Desfazer volta cada linha ao estado de antes.
 */
export function useAdjustments() {
  const { rules, loading: rulesLoading, createRule, updateRule, deleteRule } = useRules()
  const [txs, setTxs] = useState<SuggestionTx[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [local, setLocal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const all: SuggestionTx[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error: e } = await supabase
        .from('transactions')
        .select('id, description, amount, date, type, category, board_id, is_internal, counterpart_board_id, counterpart_of_id, created_at')
        .eq('user_id', user.id)
        .order('date')
        .range(from, from + PAGE - 1)
      if (e) {
        logSafeError('useAdjustments.transactions', e)
        setError(e.code === '42703'
          ? 'Falta atualizar o banco: rode a migração migration_rules_internal.sql no Supabase.'
          : 'Não foi possível ler seus lançamentos.')
        setLoading(false)
        return
      }
      if (!data?.length) break
      all.push(...(data as SuggestionTx[]))
      if (data.length < PAGE) break
    }
    setTxs(all)

    const { data: rows, error: dErr } = await supabase
      .from('adjustment_decisions')
      .select('key, status, until, undo')
      .eq('user_id', user.id)
    if (dErr && tableMissing(dErr.code)) {
      setLocal(true)
      setDecisions(readLocal())
    } else {
      if (dErr) logSafeError('useAdjustments.decisions', dErr)
      setLocal(false)
      setDecisions((rows ?? []).map(r =>
        r.status === 'snoozed' ? { key: r.key, status: 'snoozed', until: r.until }
          : r.status === 'applied' ? { key: r.key, status: 'applied', undo: r.undo as AppliedAdjustment }
            : { key: r.key, status: 'dismissed' },
      ) as Decision[])
    }
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const { boards } = useTransactionBoards()
  const cardBoardIds = useMemo(() => new Set(boards.filter(isCreditCardBoard).map(b => b.id)), [boards])
  const allSuggestions = useMemo(
    () => findPairSuggestions(txs, rules as SuggestionRule[], new Date(), cardBoardIds),
    [txs, rules, cardBoardIds],
  )

  const today = todayISO()
  const hidden = useMemo(() => new Set(decisions
    .filter(d => d.status === 'dismissed' || (d.status === 'snoozed' && d.until > today))
    .map(d => d.key)), [decisions, today])

  const suggestions = useMemo(() => allSuggestions.filter(s => !hidden.has(s.key)), [allSuggestions, hidden])
  // Ocultadas que ainda valem (o problema continua nos dados), com o motivo —
  // para o usuário poder trazer de volta uma que escondeu sem querer.
  const hiddenSuggestions = useMemo(() => allSuggestions.flatMap(s => {
    const d = decisions.find(x => x.key === s.key)
    if (!d || !hidden.has(s.key)) return []
    return [{ suggestion: s, reason: d.status === 'snoozed' ? { kind: 'snoozed' as const, until: d.until } : { kind: 'dismissed' as const } }]
  }), [allSuggestions, decisions, hidden])
  const applied = useMemo(
    () => decisions.filter((d): d is Extract<Decision, { status: 'applied' }> => d.status === 'applied')
      .sort((a, b) => b.undo.appliedAt.localeCompare(a.undo.appliedAt)),
    [decisions],
  )

  async function saveDecision(d: Decision) {
    const next = [...decisions.filter(x => x.key !== d.key), d]
    setDecisions(next)
    if (local) { writeLocal(next); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: e } = await supabase.from('adjustment_decisions').upsert({
      user_id: user.id,
      key: d.key,
      status: d.status,
      until: d.status === 'snoozed' ? d.until : null,
      undo: d.status === 'applied' ? d.undo : null,
    })
    if (e) logSafeError('useAdjustments.saveDecision', e)
  }

  async function removeDecision(key: string) {
    const next = decisions.filter(x => x.key !== key)
    setDecisions(next)
    if (local) { writeLocal(next); return }
    const supabase = createClient()
    const { error: e } = await supabase.from('adjustment_decisions').delete().eq('key', key)
    if (e) logSafeError('useAdjustments.removeDecision', e)
  }

  function snooze(s: PairSuggestion) {
    const d = new Date(); d.setDate(d.getDate() + SNOOZE_DAYS)
    const p = (n: number) => String(n).padStart(2, '0')
    return saveDecision({ key: s.key, status: 'snoozed', until: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })
  }

  function dismiss(s: PairSuggestion) {
    return saveDecision({ key: s.key, status: 'dismissed' })
  }

  async function apply(s: PairSuggestion, sides: PairSides = 'both'): Promise<{ error?: string; result?: AppliedAdjustment }> {
    const fields = {
      keyword: s.keyword,
      match_type: 'contains' as const,
      scope_board_id: s.originBoardId,
      target_board_id: s.targetBoardId,
      // Valor + data provam o par: saída com o mesmo texto sem a entrada no
      // destino continua somando.
      require_pair: true,
      pair_sides: sides,
    }
    let rule: AppliedAdjustment['rule']
    if (s.existingRule) {
      const current = rules.find(r => r.id === s.existingRule!.id)
      const prev = {
        scope_board_id: current?.scope_board_id ?? null,
        target_board_id: current?.target_board_id ?? null,
        active: current?.active ?? true,
        require_pair: current?.require_pair ?? false,
        pair_sides: current?.pair_sides ?? 'both',
      }
      const r = await updateRule(s.existingRule.id, { scope_board_id: s.originBoardId, target_board_id: s.targetBoardId, active: true, require_pair: true, pair_sides: sides })
      if (!r.ok || r.error === 'partial') {
        return { error: 'Não foi possível atualizar a regra existente. Rode a migração migration_rules_internal.sql no Supabase e tente de novo.' }
      }
      rule = { kind: 'updated', id: s.existingRule.id, prev }
      // A regra existente guarda o próprio tipo de correspondência.
      fields.match_type = (current?.match_type ?? 'contains') as 'contains'
    } else {
      try {
        const saved = await createRule(s.keyword, '', { ...fields, action: 'internal' })
        if (!saved) return { error: 'Não foi possível criar a regra.' }
        rule = { kind: 'created', id: saved.id }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Não foi possível criar a regra.' }
      }
    }

    const res = await applyInternalRule(fields)
    const result: AppliedAdjustment = {
      keyword: s.keyword,
      originBoardId: s.originBoardId,
      targetBoardId: s.targetBoardId,
      marked: res.count,
      paired: res.paired,
      legs: res.legs,
      restored: res.restored,
      sides,
      appliedAt: new Date().toISOString(),
      rule,
      tx: res.undo ?? { changed: [], legIds: [] },
    }
    // Mesmo com erro no meio, grava o que já mudou — o Desfazer precisa disso.
    await saveDecision({ key: s.key, status: 'applied', undo: result })
    await load()
    return { error: res.error, result }
  }

  async function undo(key: string): Promise<{ error?: string }> {
    const d = decisions.find(x => x.key === key)
    if (!d || d.status !== 'applied') return {}
    const { error: txErr } = await undoInternalChanges(d.undo.tx)
    if (txErr) return { error: txErr }
    if (d.undo.rule.kind === 'created') {
      await deleteRule(d.undo.rule.id)
    } else {
      await updateRule(d.undo.rule.id, d.undo.rule.prev)
    }
    await removeDecision(key)
    await load()
    return {}
  }

  const lateCredits = useMemo(() => findLateCredits(txs), [txs])

  /**
   * Apaga SÓ as entradas que o app criou depois do fato (pernas geradas,
   * listadas na tela antes). O pagamento original continua, fora das somas.
   */
  async function removeLateCredits(ids: string[]): Promise<{ error?: string; removed: number }> {
    const allowed = new Set(lateCredits.flatMap(g => g.credits.map(c => c.id)))
    const safe = ids.filter(id => allowed.has(id))
    if (safe.length === 0) return { removed: 0 }
    const supabase = createClient()
    const { data, error: e } = await supabase.from('transactions').delete()
      .in('id', safe).not('counterpart_of_id', 'is', null).select('id')
    if (e) return { error: e.message, removed: 0 }
    await load()
    return { removed: data?.length ?? 0 }
  }

  /**
   * Categoria de UM lançamento, direto da lista de pares. Só ele muda — não
   * cria regra nem mexe em outros com o mesmo texto ("Pix recebido de…" vem
   * igual de qualquer banco).
   */
  async function setCategory(id: string, category: string): Promise<{ error?: string }> {
    const supabase = createClient()
    const { error: e } = await supabase.from('transactions').update({ category }).eq('id', id)
    if (e) return { error: e.message }
    setTxs(prev => prev.map(t => (t.id === id ? { ...t, category } : t)))
    return {}
  }

  /** "Mostrar de novo": apaga a decisão de esconder. */
  function unhide(key: string) {
    return removeDecision(key)
  }

  return {
    setCategory,
    lateCredits,
    removeLateCredits,
    suggestions,
    hiddenSuggestions,
    unhide,
    applied,
    loading: loading || rulesLoading,
    error,
    decisionsLocal: local,
    apply,
    undo,
    snooze,
    dismiss,
    reload: load,
  }
}
