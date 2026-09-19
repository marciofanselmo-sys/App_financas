import type { SupabaseClient } from '@supabase/supabase-js'
import { Category, CategoryBucket, CategoryType, Subcategory, CATEGORY_COLORS } from '@/types'
import { logSafeError } from '@/lib/supabase-error'

/**
 * Conversão única para o modelo Categoria > Subcategoria.
 *
 * Antes: "Subcategoria" era um grupo (em user_metadata) que juntava várias
 * categorias — ou seja, ficava ACIMA delas. E "categoria isolada" era uma
 * categoria com meses de validade (special_dates).
 *
 * Depois:
 *   - cada grupo vira uma categoria principal, e as categorias dele viram
 *     subcategorias (parent_id);
 *   - categoria sem grupo vira subcategoria de "Outros";
 *   - categoria isolada vira evento: os lançamentos dela ficam marcados com o
 *     evento e vão para Lazer › Viagens (receitas vão para Outros).
 *
 * planCategoryConversion só calcula — é o que a prévia mostra. A gravação é
 * applyCategoryConversion, idempotente: se cair no meio, rodar de novo termina
 * o que faltou sem duplicar nada.
 */

export const OUTROS = 'Outros'
const LAZER = 'Lazer'
const VIAGENS = 'Viagens'

export interface PlannedParent {
  name: string
  type: CategoryType
  existing: Category | null        // null = será criada
  bucket: CategoryBucket | null    // sugestão para as que ainda não têm
  children: { name: string; existing: Category | null }[]
}

export interface PlannedEvent {
  name: string
  color: string
  fromCategory: Category
}

export interface CategoryConversionPlan {
  parents: PlannedParent[]
  events: PlannedEvent[]
  /** Nada a fazer — ninguém sem mãe, nenhuma categoria isolada. */
  empty: boolean
}

const norm = (s: string) => s.trim().toLowerCase()
const isSpecial = (c: Category) => (c.special_dates?.length ?? 0) > 0

// Sugestão 50/30/20 pelo nome — só um ponto de partida, ajustável depois.
const BUCKET_HINTS: [RegExp, CategoryBucket][] = [
  [/invest|reserva|previd|poupan/, 'futuro'],
  [/lazer|viage|pessoal|compra|restaur|delivery|stream|hobb|beleza|roupa|presente|assinatura/, 'estilo'],
  [/moradia|casa|aluguel|condom|alimenta|mercado|transporte|carro|sa[uú]de|farm|educa|escola|financeiro|tarifa|imposto|conta|luz|[aá]gua|internet|seguro|filho|pet/, 'essencial'],
]

export function suggestBucket(name: string, type: CategoryType): CategoryBucket | null {
  if (type === 'receita') return null
  const n = norm(name)
  for (const [re, bucket] of BUCKET_HINTS) if (re.test(n)) return bucket
  return null
}

export function planCategoryConversion(
  categories: Category[],
  groups: Subcategory[],
): CategoryConversionPlan {
  const normal = categories.filter(c => !isSpecial(c))
  const specials = categories.filter(isSpecial)
  const byName = new Map(normal.map(c => [norm(c.name), c]))

  const parents = new Map<string, PlannedParent>()
  const assigned = new Set<string>() // nomes (norm) que já ganharam mãe neste plano

  const ensureParent = (name: string, type: CategoryType): PlannedParent => {
    const key = norm(name)
    let p = parents.get(key)
    if (!p) {
      const existing = byName.get(key) ?? null
      p = {
        name: existing?.name ?? name,
        type: existing?.type ?? type,
        existing,
        bucket: existing?.bucket ?? suggestBucket(name, existing?.type ?? type),
        children: [],
      }
      parents.set(key, p)
    }
    return p
  }

  const addChild = (parent: PlannedParent, name: string, existing: Category | null) => {
    const key = norm(name)
    // "Outros" é sempre mãe (recebe as sem grupo) — nunca vira filha, senão
    // as sobras iriam parar no terceiro nível.
    if (assigned.has(key) || parents.has(key) || key === norm(OUTROS)) return
    assigned.add(key)
    parent.children.push({ name: existing?.name ?? name, existing })
  }

  // Quem já tem mãe (conversão anterior, ou usuário novo com a árvore padrão)
  // fica onde está — e a mãe dele também é principal.
  for (const c of normal) {
    if (!c.parent_id) continue
    const mother = normal.find(m => m.id === c.parent_id)
    if (mother) { ensureParent(mother.name, mother.type); assigned.add(norm(c.name)) }
  }

  // 1. Grupos antigos viram categorias principais.
  for (const g of groups) ensureParent(g.name, g.type)
  for (const g of groups) {
    const parent = parents.get(norm(g.name))!
    for (const childName of g.categories ?? []) {
      const child = byName.get(norm(childName))
      if (child && !child.parent_id) addChild(parent, child.name, child)
    }
  }

  // 2. Categorias isoladas → eventos. O destino (Lazer › Viagens) precisa
  //    existir antes da regra do "Outros", senão o Lazer sem grupo iria parar
  //    dentro de Outros e o Viagens ficaria no terceiro nível.
  const events: PlannedEvent[] = specials.map(c => ({ name: c.name, color: c.color, fromCategory: c }))
  if (events.length > 0) {
    const viagens = byName.get(norm(VIAGENS)) ?? null
    if (!viagens || (!viagens.parent_id && !assigned.has(norm(VIAGENS)) && !parents.has(norm(VIAGENS)))) {
      const lazerKey = norm(LAZER)
      const lazer = byName.get(lazerKey)
      // Lazer já é filho de alguém? Viagens vai para a mesma mãe.
      const lazerMother = lazer?.parent_id
        ? normal.find(m => m.id === lazer.parent_id)
        : [...parents.values()].find(p => p.children.some(ch => norm(ch.name) === lazerKey))
      const target = lazerMother ? ensureParent(lazerMother.name, lazerMother.type) : ensureParent(LAZER, 'despesa')
      addChild(target, VIAGENS, viagens)
    }
  }

  // 3. O resto (sem grupo, sem mãe) vai para "Outros".
  const leftovers = normal.filter(c =>
    !c.parent_id && !assigned.has(norm(c.name)) && !parents.has(norm(c.name)) && norm(c.name) !== norm(OUTROS),
  )
  if (leftovers.length > 0 || byName.has(norm(OUTROS))) {
    const outros = ensureParent(OUTROS, 'ambos')
    outros.bucket = outros.existing?.bucket ?? null
    for (const c of leftovers) addChild(outros, c.name, c)
  }

  const ordered = [...parents.values()]
    .map(p => ({ ...p, children: [...p.children].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }))
    .sort((a, b) => {
      // "Outros" sempre por último; o resto em ordem alfabética.
      if (norm(a.name) === norm(OUTROS)) return 1
      if (norm(b.name) === norm(OUTROS)) return -1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

  const changes =
    events.length > 0 ||
    ordered.some(p => !p.existing || p.children.some(ch => !ch.existing || !ch.existing.parent_id))

  return { parents: ordered, events, empty: !changes }
}

function newId() {
  return crypto.randomUUID()
}

export async function applyCategoryConversion(
  supabase: SupabaseClient,
  userId: string,
  plan: CategoryConversionPlan,
): Promise<{ error: string | null }> {
  const fail = (where: string, error: unknown, message: string) => {
    logSafeError(`categoryConversion.${where}`, error)
    return { error: message }
  }
  const now = () => new Date().toISOString()

  // 1. Mães que ainda não existem. upsert por nome: se uma tentativa anterior
  //    já criou, não duplica — e o id certo vem da releitura abaixo.
  const colorFor = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]
  const newParents = plan.parents.filter(p => !p.existing)
  if (newParents.length > 0) {
    const { error } = await supabase.from('categories').upsert(
      newParents.map((p, i) => ({
        id: newId(), user_id: userId, name: p.name, type: p.type,
        color: colorFor(i), bucket: p.bucket, created_at: now(),
      })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )
    if (error) return fail('createParents', error, 'Não foi possível criar as categorias principais.')
  }

  // Sugestão 50/30/20 nas mães que já existiam e ainda não tinham etiqueta.
  for (const p of plan.parents) {
    if (p.existing && !p.existing.bucket && p.bucket) {
      const { error } = await supabase.from('categories').update({ bucket: p.bucket }).eq('id', p.existing.id)
      if (error) return fail('parentBucket', error, 'Não foi possível salvar a etiqueta 50/30/20.')
    }
  }

  const { data: fresh, error: readError } = await supabase
    .from('categories').select('id, name, parent_id').eq('user_id', userId)
  if (readError || !fresh) return fail('reread', readError, 'Não foi possível reler as categorias.')
  const idByName = new Map(fresh.map(c => [norm(c.name as string), c.id as string]))

  // 2. Subcategorias: cria as que faltam (ex.: Viagens) e liga à mãe.
  for (const p of plan.parents) {
    const parentId = idByName.get(norm(p.name))
    if (!parentId) return fail('parentMissing', null, `A categoria "${p.name}" não foi encontrada depois de criada.`)

    const missing = p.children.filter(ch => !idByName.has(norm(ch.name)))
    if (missing.length > 0) {
      const { error } = await supabase.from('categories').upsert(
        missing.map(ch => ({
          id: newId(), user_id: userId, name: ch.name, type: p.type === 'receita' ? 'receita' : 'despesa',
          color: CATEGORY_COLORS[0], parent_id: parentId, created_at: now(),
        })),
        { onConflict: 'user_id,name', ignoreDuplicates: true },
      )
      if (error) return fail('createChildren', error, `Não foi possível criar subcategorias em "${p.name}".`)
    }

    const childNames = p.children.map(ch => ch.name)
    if (childNames.length > 0) {
      const { error } = await supabase.from('categories')
        .update({ parent_id: parentId })
        .eq('user_id', userId)
        .in('name', childNames)
      if (error) return fail('linkChildren', error, `Não foi possível mover subcategorias para "${p.name}".`)
    }
  }

  // 3. Categorias isoladas → eventos.
  for (const ev of plan.events) {
    const { data: event, error: evError } = await supabase
      .from('events')
      .upsert({ user_id: userId, name: ev.name, color: ev.color }, { onConflict: 'user_id,name' })
      .select('id')
      .single()
    if (evError || !event) return fail('createEvent', evError, `Não foi possível criar o evento "${ev.name}".`)

    const from = ev.fromCategory.name
    const moves: [string, string][] = [['despesa', VIAGENS], ['receita', OUTROS]]
    for (const [type, target] of moves) {
      const { error } = await supabase.from('transactions')
        .update({ category: target, event_id: event.id })
        .eq('user_id', userId).eq('category', from).eq('type', type)
      if (error) return fail('moveTransactions', error, `Não foi possível mover os lançamentos de "${from}".`)
    }

    const { error: rulesError } = await supabase.from('categorization_rules')
      .update({ category: VIAGENS }).eq('user_id', userId).eq('category', from)
    if (rulesError) return fail('moveRules', rulesError, `Não foi possível atualizar as regras de "${from}".`)

    // Só apaga depois que nada mais aponta para ela.
    const { error: delError } = await supabase.from('categories').delete().eq('id', ev.fromCategory.id)
    if (delError) return fail('deleteSpecial', delError, `Não foi possível remover a categoria isolada "${from}".`)
  }

  const { error: metaError } = await supabase.auth.updateUser({ data: { category_tree_v2: true } })
  if (metaError) return fail('flag', metaError, 'A conversão foi feita, mas não foi possível marcá-la como concluída.')

  return { error: null }
}
