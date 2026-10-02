'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, TransactionType } from '@/types'
import { isCategoryUsableForDate } from '@/lib/special-category-filter'
import { findPairedEntry } from '@/lib/internal-counterpart'

export type MatchType = 'contains' | 'starts_with' | 'ends_with' | 'exact'

// 'categorize': a regra de sempre (texto → categoria).
// 'internal': "Entre minhas contas" — marca o lançamento para não somar em
// gasto nem ganho (ex.: pagamento da fatura saindo da conta corrente).
export type RuleAction = 'categorize' | 'internal'

export interface CategorizationRule {
  id: string
  user_id: string
  keyword: string
  match_type: MatchType
  category: string
  board_id: string | null
  active: boolean
  created_at: string
  auto_created?: boolean
  action?: RuleAction
  // Só para 'internal': a regra vale só para lançamentos desta conta.
  scope_board_id?: string | null
  // Só para 'internal': conta que recebe o dinheiro — o app credita ela.
  target_board_id?: string | null
  // Só para 'internal' com destino: marca a saída apenas quando o destino tem
  // a entrada do mesmo valor (até 5 dias). Sem ela, a saída continua somando.
  require_pair?: boolean
  // Só para 'internal' com destino: qual lado do par não soma. 'out' = só a
  // saída (PIX da conta PJ: não é gasto, mas é renda quando chega); 'in' = só
  // a entrada; 'both' = os dois (fatura do cartão).
  pair_sides?: PairSides
}

export type PairSides = 'both' | 'out' | 'in'

export const isInternalRule = (r: Pick<CategorizationRule, 'action'>) => r.action === 'internal'

export function matchesRule(description: string, rule: CategorizationRule): boolean {
  const desc = description.toUpperCase()
  const kw   = rule.keyword.toUpperCase()
  switch (rule.match_type) {
    case 'starts_with': return desc.startsWith(kw)
    case 'ends_with':   return desc.endsWith(kw)
    case 'exact':       return desc === kw
    default:            return desc.includes(kw)
  }
}

// Se a categoria da regra for especial (presa a meses específicos), a regra só
// vale para transações cuja data caia em um dos meses configurados nela.
function ruleUsableForDate(rule: CategorizationRule, date: string, categories: Category[]): boolean {
  const cat = categories.find(c => c.name === rule.category)
  if (!cat) return true
  return isCategoryUsableForDate(cat, date)
}

// Uma regra só pode ser aplicada a uma transação do mesmo tipo da sua categoria
// alvo (receita/despesa) — "ambos" (ex: "Outros") vale pra qualquer tipo. Evita
// que uma descrição igual por coincidência (ex: "Ajuste") em contextos
// diferentes espalhe a categoria errada.
function ruleUsableForType(rule: CategorizationRule, type: TransactionType, categories: Category[]): boolean {
  const cat = categories.find(c => c.name === rule.category)
  if (!cat) return true
  return cat.type === type || cat.type === 'ambos'
}

export function applyUserRules(
  description: string,
  date: string,
  rules: CategorizationRule[],
  categories: Category[],
  type: TransactionType
): { category: string | null; board_id: string | null } {
  for (const rule of rules) {
    if (isInternalRule(rule)) continue
    if (
      rule.active &&
      matchesRule(description, rule) &&
      ruleUsableForDate(rule, date, categories) &&
      ruleUsableForType(rule, type, categories)
    ) {
      return { category: rule.category, board_id: rule.board_id ?? null }
    }
  }
  return { category: null, board_id: null }
}

// Igual applyRuleToExisting, mas pro campo `type` (Despesa/Receita)
// em vez de categoria — mudar o Tipo de uma transação editada também "gruda"
// em todas as outras com a mesma descrição exata, do mesmo jeito que já
// acontecia só com categoria. Sem isso, corrigir o tipo de UMA transação
// deixava as demais com a mesma descrição presas no tipo antigo.
export async function applyTypeToExisting(
  description: string,
  newType: TransactionType,
): Promise<{ count: number; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const kw = description.trim().toUpperCase()
  if (!kw) return { count: 0 }

  const txs: { id: string; description: string }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description')
      .eq('user_id', user.id)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[applyTypeToExisting] select error:', error.message, '| code:', error.code)
      return { count: 0, error: error.message }
    }
    if (!data?.length) break
    txs.push(...data)
    if (data.length < PAGE) break
  }

  const ids = txs.filter(t => t.description.trim().toUpperCase() === kw).map(t => t.id)
  if (!ids.length) return { count: 0 }

  const { data, error } = await supabase.from('transactions').update({ type: newType }).in('id', ids).select('id')
  if (error) {
    console.error('[applyTypeToExisting] update error:', error.message, '| code:', error.code, '| details:', error.details)
    const friendly = error.code === '23514'
      ? 'Tipo não permitido pelo banco de dados.'
      : error.message
    return { count: 0, error: friendly }
  }
  return { count: data?.length ?? 0 }
}

export async function applyRuleToExisting(
  rule: { keyword: string; match_type: string; category: string; board_id: string | null },
  categories: Category[]
): Promise<{ count: number; error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const targetCategory = categories.find(c => c.name === rule.category)
  // Categoria especial nunca é sobrescrita por uma regra — uma vez que uma
  // transação está numa categoria especial, ela fica isolada (só muda por edição manual).
  const specialCategoryNames = new Set(
    categories.filter(c => c.special_dates && c.special_dates.length > 0).map(c => c.name)
  )

  // Busca paginada — o Supabase limita a 1000 linhas por consulta por padrão,
  // então sem paginação transações além desse limite seriam ignoradas em silêncio.
  const txs: { id: string; description: string; date: string; category: string; type: string }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, date, category, type')
      .eq('user_id', user.id)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[applyRuleToExisting] select error:', error.message, '| code:', error.code)
      return { count: 0, error: error.message }
    }
    if (!data?.length) break
    txs.push(...data)
    if (data.length < PAGE) break
  }

  if (!txs.length) return { count: 0 }

  const kw = rule.keyword.toUpperCase()
  const ids = txs
    .filter(t => {
      if (specialCategoryNames.has(t.category)) return false
      const desc = t.description.toUpperCase()
      const descMatches = (() => {
        switch (rule.match_type) {
          case 'starts_with': return desc.startsWith(kw)
          case 'ends_with':   return desc.endsWith(kw)
          case 'exact':       return desc === kw
          default:            return desc.includes(kw)
        }
      })()
      if (!descMatches) return false
      if (!targetCategory) return true
      if (targetCategory.type !== 'ambos' && targetCategory.type !== t.type) return false
      return isCategoryUsableForDate(targetCategory, t.date)
    })
    .map(t => t.id)

  if (!ids.length) return { count: 0 }

  const update: Record<string, unknown> = { category: rule.category }
  if (rule.board_id) update.board_id = rule.board_id

  // `.select()` no update pra pegar a contagem REAL de linhas afetadas — sem
  // isso, um update que bate 0 linhas (ex: RLS barrando silenciosamente, ou
  // update sem erro mas sem efeito) ainda reportava `ids.length` como se
  // tivesse dado certo, mostrando "N transações atualizadas" mesmo quando
  // nada mudou de verdade no banco.
  const { data, error } = await supabase.from('transactions').update(update).in('id', ids).select('id')
  if (error) {
    console.error('[applyRuleToExisting] update error:', error.message, '| code:', error.code, '| details:', error.details)
    const friendly = error.code === '23514'
      ? 'Categoria não permitida pelo banco de dados. Rode a migração migration_categories.sql no Supabase.'
      : error.message
    return { count: 0, error: friendly }
  }
  const actualCount = data?.length ?? 0
  if (actualCount < ids.length) {
    console.warn(`[applyRuleToExisting] esperava atualizar ${ids.length} transações, mas só ${actualCount} vieram de volta — possível bloqueio de RLS.`)
  }
  return { count: actualCount }
}

// ── Regra "Entre minhas contas" ─────────────────────────────────────────────

type InternalRuleFields = Pick<CategorizationRule, 'keyword' | 'match_type' | 'scope_board_id' | 'target_board_id' | 'require_pair' | 'pair_sides'> & { active?: boolean }

export function matchesInternalRule(
  tx: { description: string; board_id?: string | null },
  rule: InternalRuleFields,
): boolean {
  if (rule.active === false) return false
  if (rule.scope_board_id && tx.board_id !== rule.scope_board_id) return false
  return matchesRule(tx.description, rule as CategorizationRule)
}

/** A primeira regra "Entre minhas contas" ativa que casa com o lançamento. */
export function findInternalRule(
  description: string,
  boardId: string | null | undefined,
  rules: CategorizationRule[],
): CategorizationRule | null {
  return rules.find(r => isInternalRule(r) && matchesInternalRule({ description, board_id: boardId }, r)) ?? null
}

/**
 * Conta que o lançamento quita, pela regra: só em SAÍDAS (mesma lógica da
 * detecção automática — a descrição de uma entrada não diz de onde veio) e
 * nunca a própria conta de origem.
 */
export function internalRuleTarget(
  rule: Pick<CategorizationRule, 'target_board_id'>,
  tx: { type: string; board_id?: string | null },
): string | null {
  const target = rule.target_board_id ?? null
  if (!target || tx.type !== 'despesa' || target === tx.board_id) return null
  return target
}

interface TxForInternal {
  id: string; description: string; amount: number; date: string; type: 'receita' | 'despesa'
  category: string; board_id: string | null; is_internal: boolean | null
  counterpart_board_id: string | null; counterpart_of_id: string | null
}

/** O que uma aplicação mudou, para poder desfazer (valores ANTERIORES). */
export interface InternalUndo {
  changed: { id: string; is_internal: boolean; counterpart_board_id: string | null }[]
  legIds: string[]
}

export interface InternalApplyResult {
  count: number    // saídas que a regra pegou (marcadas)
  skipped?: number // saídas com o texto, mas sem entrada no destino (require_pair): seguem somando
  paired: number   // entradas do banco no destino que passaram a não somar
  restored?: number // lançamentos do lado NÃO escolhido que voltaram a somar
  legs: number     // entradas criadas pelo app no destino (banco não lança)
  error?: string
  undo?: InternalUndo
}

/**
 * Aplica a regra "Entre minhas contas" no que JÁ está no banco — é isso que
 * a detecção da importação não fazia: pagamentos importados antes dela
 * continuavam somando como gasto. Com `dryRun`, só conta quantos casariam
 * (para a tela mostrar "encontrei N" antes de salvar).
 *
 * Com conta de destino, marca o PAR inteiro: a saída e, no destino, a entrada
 * que o próprio banco lançou (o "Pix recebido" no C6 de um PIX que saiu do
 * Itaú). Sem casar a entrada, o mesmo dinheiro continuava contando como receita.
 *
 * NUNCA cria lançamento: aplicar no histórico só marca, então o saldo de
 * nenhuma conta muda. Antes (29–30/09/2026) criava a entrada no destino para
 * pagamentos sem par — salvar a regra da fatura do C6 lançou créditos de
 * faturas cujas compras nunca foram importadas e deixou o cartão positivo.
 * A entrada da fatura (C6 não traz o pagamento) continua sendo criada só na
 * importação, quando pagamento e fatura chegam juntos.
 *
 * Devolve em `undo` o estado anterior de cada linha alterada — os Ajustes sugeridos
 * usam isso para o botão "Desfazer".
 */
export async function applyInternalRule(
  rule: InternalRuleFields,
  opts: { dryRun?: boolean } = {},
): Promise<InternalApplyResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0, paired: 0, legs: 0 }

  const txs: TxForInternal[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, amount, date, type, category, board_id, is_internal, counterpart_board_id, counterpart_of_id')
      .eq('user_id', user.id)
      .range(from, from + PAGE - 1)
    if (error) {
      const friendly = error.code === '42703'
        ? 'Falta atualizar o banco: rode a migração migration_rules_internal.sql no Supabase.'
        : error.message
      return { count: 0, paired: 0, legs: 0, error: friendly }
    }
    if (!data?.length) break
    txs.push(...(data as TxForInternal[]))
    if (data.length < PAGE) break
  }

  // A perna gerada pelo app nunca é alvo: ela já é a outra ponta.
  const matches = txs.filter(t => !t.counterpart_of_id && matchesInternalRule(t, rule))
  const target = rule.target_board_id ?? null
  const withTarget = matches.filter(t => internalRuleTarget(rule, t))
  const plain = matches.filter(t => !internalRuleTarget(rule, t))

  // Qual lado do par sai das somas. O outro lado é garantido somando — se uma
  // aplicação anterior (ou versão antiga do app) o tinha marcado, volta a somar.
  const sides: PairSides = target ? (rule.pair_sides ?? 'both') : 'both'
  const markOut = sides !== 'in'
  const markEntry = sides !== 'out'

  // Pareamento no destino, calculado antes de gravar (serve também à prévia).
  const alreadyGenerated = new Set(txs.filter(t => t.counterpart_of_id).map(t => t.counterpart_of_id))
  const destTxs = target ? txs.filter(t => t.board_id === target && !t.counterpart_of_id) : []
  const used = new Set<string>()
  const outsToMark: TxForInternal[] = []    // saem das somas
  const outsToClear: TxForInternal[] = []   // voltam a somar (lado não escolhido)
  const entriesToMark: TxForInternal[] = []
  const entriesToClear: TxForInternal[] = []
  const unpaired: TxForInternal[] = []
  const isMarked = (t: TxForInternal) => !!t.is_internal || !!t.counterpart_board_id
  for (const t of withTarget) {
    // Já ligado a OUTRA conta (ex.: o usuário marcou à mão "Aporte em Binance"
    // num TED que a regra da RICO também pegaria): a escolha dele vale mais.
    if (t.counterpart_board_id && t.counterpart_board_id !== target) continue
    if (alreadyGenerated.has(t.id)) { if (markOut) outsToMark.push(t); continue }
    const entry = findPairedEntry(destTxs, target!, Number(t.amount), t.date, 'receita', used)
    if (entry) {
      used.add(entry.id)
      if (markOut) outsToMark.push(t)
      else if (isMarked(t)) outsToClear.push(t)
      if (markEntry && !entry.is_internal) entriesToMark.push(entry)
      if (!markEntry && entry.is_internal) entriesToClear.push(entry)
    } else if (rule.require_pair) {
      // Sem a entrada no destino não há prova de que foi para a sua conta.
      unpaired.push(t)
    } else if (markOut) {
      outsToMark.push(t)
    }
  }
  const count = plain.length + outsToMark.length
  const restored = outsToClear.length + entriesToClear.length
  const summary = { count, skipped: unpaired.length, paired: entriesToMark.length, restored, legs: 0 }

  if (opts.dryRun || count + entriesToMark.length + restored === 0) return summary

  const undo: InternalUndo = { changed: [], legIds: [] }
  const remember = (t: TxForInternal) =>
    undo.changed.push({ id: t.id, is_internal: !!t.is_internal, counterpart_board_id: t.counterpart_board_id })
  const write = async (list: TxForInternal[], values: Record<string, unknown>) => {
    if (list.length === 0) return null
    const { error } = await supabase.from('transactions').update(values).in('id', list.map(t => t.id))
    if (!error) list.forEach(remember)
    return error
  }

  const failed = (what: string, message: string) => ({ ...summary, undo, error: `${what}: ${message}` })
  let e = await write(plain.filter(t => !t.is_internal), { is_internal: true })
  if (e) return failed('Não deu para marcar as saídas', e.message)
  e = await write(outsToMark.filter(t => !t.is_internal || t.counterpart_board_id !== target), { is_internal: true, counterpart_board_id: target })
  if (e) return failed('Não deu para marcar as saídas', e.message)
  e = await write(entriesToMark, { is_internal: true })
  if (e) return failed('Saídas marcadas, mas não deu para marcar as entradas na conta de destino', e.message)
  e = await write(outsToClear, { is_internal: false, counterpart_board_id: null })
  if (e) return failed('Não deu para voltar a somar as saídas', e.message)
  e = await write(entriesToClear, { is_internal: false })
  if (e) return failed('Não deu para voltar a somar as entradas', e.message)

  return { ...summary, undo }
}

/** Volta cada linha ao estado de antes e apaga as entradas que o app criou. */
export async function undoInternalChanges(undo: InternalUndo): Promise<{ error?: string }> {
  const supabase = createClient()
  // Agrupa por estado anterior: um update por combinação, não um por linha.
  const groups = new Map<string, string[]>()
  for (const c of undo.changed) {
    const k = JSON.stringify([c.is_internal, c.counterpart_board_id])
    groups.set(k, [...(groups.get(k) ?? []), c.id])
  }
  for (const [k, ids] of groups) {
    const [is_internal, counterpart_board_id] = JSON.parse(k) as [boolean, string | null]
    const { error } = await supabase.from('transactions').update({ is_internal, counterpart_board_id }).in('id', ids)
    if (error) return { error: error.message }
  }
  if (undo.legIds.length > 0) {
    const { error } = await supabase.from('transactions').delete().in('id', undo.legIds)
    if (error) return { error: error.message }
  }
  return {}
}

/**
 * Marca/desmarca lançamentos como "Entre minhas contas" (edição manual, um ou
 * vários). Só mexe na marca "não soma" — NUNCA cria nem apaga lançamento, então
 * o saldo de nenhuma conta muda. (Antes, desmarcar apagava o crédito que o app
 * tinha lançado no cartão, e o saldo do cartão mudava; decisão do dono em
 * 30/09/2026: só a exclusão pode mudar saldo.)
 *
 * A perna gerada pelo app (counterpart_of_id) fica de fora: ela é a outra
 * ponta de um pagamento e segue a marca dele.
 */
export async function setTransactionsInternal(ids: string[], internal: boolean): Promise<{ error?: string }> {
  if (ids.length === 0) return {}
  const supabase = createClient()
  const values = internal ? { is_internal: true } : { is_internal: false, counterpart_board_id: null }
  const { error } = await supabase.from('transactions').update(values).in('id', ids).is('counterpart_of_id', null)
  return { error: error?.message }
}

/**
 * Marca lançamentos como APORTE numa conta de investimento: continuam na conta
 * onde estão (o saldo dela não muda), não somam como gasto e passam a aparecer
 * na conta de investimento como aporte recebido — o mesmo lançamento, sem
 * cópia, então nada conta duas vezes no patrimônio.
 *
 * investmentBoardId = null → "Não é aporte": desfaz a ligação e o lançamento
 * fica como "Entre contas · não soma" (para voltar a somar, há a ação própria).
 */
export async function setTransactionsAporte(ids: string[], investmentBoardId: string | null): Promise<{ error?: string }> {
  if (ids.length === 0) return {}
  const supabase = createClient()
  const values = investmentBoardId
    ? { is_internal: true, counterpart_board_id: investmentBoardId }
    : { is_internal: true, counterpart_board_id: null }
  const { error } = await supabase.from('transactions').update(values).in('id', ids)
    .is('counterpart_of_id', null).eq('type', 'despesa')
  return { error: error?.message }
}

export function setTransactionInternal(id: string, internal: boolean): Promise<{ error?: string }> {
  return setTransactionsInternal([id], internal)
}

export function useRules() {
  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchRules() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('categorization_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    // normalise legacy rows that may lack match_type
    const normalised = (data ?? []).map(r => ({
      ...r,
      match_type: r.match_type ?? 'contains',
      board_id: r.board_id ?? null,
    })) as CategorizationRule[]
    setRules(normalised)
    setLoading(false)
  }

  useEffect(() => { fetchRules() }, [])

  async function createRule(
    keyword: string,
    category: string,
    extra?: Partial<Pick<CategorizationRule, 'match_type' | 'board_id' | 'action' | 'scope_board_id' | 'target_board_id' | 'require_pair' | 'pair_sides'>>
  ) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const id = crypto.randomUUID()
    const fullRule = {
      id,
      user_id: user.id,
      keyword,
      match_type: extra?.match_type ?? 'contains',
      category,
      board_id: extra?.board_id ?? null,
      active: true,
      ...(extra?.action === 'internal'
        ? {
            action: 'internal', scope_board_id: extra.scope_board_id ?? null, target_board_id: extra.target_board_id ?? null,
            // Só envia quando ligado: banco sem a coluna nova continua criando
            // as regras de sempre.
            ...(extra.require_pair ? { require_pair: true } : {}),
            ...(extra.pair_sides && extra.pair_sides !== 'both' ? { pair_sides: extra.pair_sides } : {}),
          }
        : {}),
    }
    let res = await supabase
      .from('categorization_rules')
      .insert(fullRule)
      .select()
      .single()

    // Regra "Entre minhas contas" sem as colunas novas não pode cair no
    // fallback abaixo — viraria uma regra de categoria com categoria vazia.
    if (res.error && extra?.action === 'internal') {
      console.error('Erro ao criar regra entre contas:', res.error)
      // Sobe o erro real para a tela — "rode a migração" genérico escondia
      // qual passo do banco faltava.
      throw new Error(res.error.code === '42703'
        ? 'Falta atualizar o banco: rode a migração migration_rules_internal.sql no Supabase.'
        : res.error.code === '23505'
          ? 'Já existe uma regra com esse mesmo texto e tipo de correspondência. Edite a existente ou mude o texto.'
          : res.error.message)
    }

    // Fallback: match_type/board_id columns may not exist yet (migration_rules.sql not yet run)
    if (res.error) {
      res = await supabase
        .from('categorization_rules')
        .insert({ id, user_id: user.id, keyword, category, active: true })
        .select()
        .single()
    }

    if (res.error || !res.data) {
      console.error('Erro ao criar regra:', res.error)
      return
    }
    const saved = res.data as CategorizationRule
    setRules(prev => [...prev, { ...saved, match_type: saved.match_type ?? 'contains', board_id: saved.board_id ?? null }])
    return saved
  }

  async function updateRule(
    id: string,
    data: Partial<Pick<CategorizationRule, 'keyword' | 'match_type' | 'category' | 'board_id' | 'active' | 'scope_board_id' | 'target_board_id' | 'require_pair' | 'pair_sides'>>
  ): Promise<{ ok: boolean; error?: string }> {
    const supabase = createClient()

    // Tenta atualizar com todos os campos
    const { error } = await supabase
      .from('categorization_rules')
      .update(data)
      .eq('id', id)

    if (!error) {
      setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r))
      return { ok: true }
    }

    // Fallback: colunas match_type / board_id podem não existir no banco ainda.
    // Tenta salvar apenas os campos que com certeza existem.
    const safeData: Partial<Pick<CategorizationRule, 'keyword' | 'category' | 'active'>> = {}
    if (data.keyword   !== undefined) safeData.keyword  = data.keyword
    if (data.category  !== undefined) safeData.category = data.category
    if (data.active    !== undefined) safeData.active   = data.active

    if (Object.keys(safeData).length > 0) {
      const { error: error2 } = await supabase
        .from('categorization_rules')
        .update(safeData)
        .eq('id', id)

      if (!error2) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, ...safeData } : r))
        // Retorna aviso (não erro fatal) para que a UI informe sobre a migration
        return { ok: true, error: 'partial' }
      }
    }

    console.error('Erro ao atualizar regra:', error)
    return { ok: false, error: error.message }
  }

  async function deleteRule(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('categorization_rules')
      .delete()
      .eq('id', id)
    if (error) { console.error('Erro ao excluir regra:', error); return }
    setRules(prev => prev.filter(r => r.id !== id))
  }

  // Toda vez que uma transação é recategorizada manualmente para uma categoria
  // NORMAL, cria (ou atualiza) uma regra de correspondência exata pela descrição
  // e aplica retroativamente — assim a mudança "gruda" em todas as transações com
  // esse nome exato, sem precisar criar a regra manualmente. Categoria especial
  // nunca entra aqui: fica isolada, só muda por edição manual, transação por transação.
  // Faz o insert/update direto (não reusa createRule/updateRule) para expor o erro
  // real do Postgres em vez de engolir silenciosamente.
  async function syncCategoryToRule(
    description: string,
    category: string,
    categories: Category[]
  ): Promise<{ applied: number; error?: string }> {
    const targetCategory = categories.find(c => c.name === category)
    const isSpecial = !!(targetCategory?.special_dates && targetCategory.special_dates.length > 0)
    if (isSpecial) return { applied: 0 }

    const kw = description.trim().toUpperCase()
    if (!kw) return { applied: 0 }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { applied: 0, error: 'Não autenticado.' }

    // Se já existe uma regra "Entre minhas contas" com esse mesmo texto exato,
    // o upsert abaixo cairia nela (mesma chave única) e a transformaria numa
    // regra de categoria. Recategorizar esse lançamento não mexe na regra.
    if (rules.some(r => isInternalRule(r) && r.match_type === 'exact' && r.keyword.toUpperCase() === kw)) {
      return { applied: 0 }
    }

    // Upsert atômico no banco (precisa da constraint única de
    // migration_rules_unique.sql em user_id+keyword+match_type) — em vez de
    // "checar se existe, depois inserir ou atualizar". Esse padrão antigo tinha
    // uma corrida real: se duas transações com a mesma descrição fossem
    // recategorizadas quase ao mesmo tempo, as duas checagens podiam rodar
    // ANTES de qualquer inserção terminar, e as duas criavam uma regra —
    // gerando duplicata. Upsert resolve isso no próprio banco, sem essa janela.
    const { data, error } = await supabase
      .from('categorization_rules')
      .upsert(
        {
          user_id: user.id,
          keyword: kw,
          match_type: 'exact',
          category,
          board_id: null,
          active: true,
          auto_created: true,
        },
        { onConflict: 'user_id,keyword,match_type' }
      )
      .select()
      .single()
    if (error || !data) {
      console.error('[syncCategoryToRule] upsert error:', error?.message, '| code:', error?.code, '| details:', error?.details)
      const friendly = error?.code === '23502'
        ? 'A coluna "id" de categorization_rules não tem geração automática configurada. Rode a migração migration_rules_id_default.sql no Supabase.'
        : error?.code === '42P10'
          ? 'Falta uma trava no banco pra evitar regra duplicada. Rode a migração migration_rules_unique.sql no Supabase.'
          : error?.message
      return { applied: 0, error: friendly }
    }
    const rule = data as CategorizationRule
    setRules(prev => (prev.some(r => r.id === rule.id) ? prev.map(r => (r.id === rule.id ? rule : r)) : [...prev, rule]))

    const { count, error: applyError } = await applyRuleToExisting(
      { keyword: rule.keyword, match_type: rule.match_type, category: rule.category, board_id: rule.board_id },
      categories,
    )
    return { applied: count, error: applyError }
  }

  return { rules, loading, createRule, updateRule, deleteRule, syncCategoryToRule }
}
