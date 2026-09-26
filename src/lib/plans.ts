import type { SubscriptionStatus } from '@/hooks/use-subscription'

/**
 * Os três planos do NOBLI, num lugar só.
 *
 * Regra de ouro do recorte: **nenhum plano corta histórico**. Limitar os
 * meses de dados esvazia Recorrências (precisa de 2 meses) e o Relatório
 * Anual (precisa de 12) — entregar tela vazia é pior do que não ter a tela.
 * O que separa os planos é quantidade de contas, importação e as telas que
 * economizam tempo.
 */
export type PlanTier = 'free' | 'essencial' | 'completo'

export type Feature =
  | 'import'        // importar extrato
  | 'rules'         // regras automáticas
  | 'recurring'     // recorrências e parcelas
  | 'planning'      // planejamento mensal e 50/30/20
  | 'reports'       // relatórios
  | 'reportsFull'   // além do mensal: anual, parcelas, fixos, investimentos
  | 'export'        // exportar CSV
  | 'investments'   // carteira e proventos
  | 'goals'         // metas

/** Tela do menu → recurso do plano que ela exige (mesmo usado no withPlan da página). */
export const ROUTE_FEATURE: Record<string, Feature> = {
  '/reports':        'reports',
  '/investments':    'investments',
  '/planning':       'planning',
  '/goals':          'goals',
  '/recurring':      'recurring',
  '/fixos':          'recurring',
  '/settings/rules': 'rules',
}

export interface PlanDefinition {
  tier: PlanTier
  label: string
  /** null = sem limite */
  maxBoards: number | null
  /** Importações de extrato por mês; null = sem limite */
  importsPerMonth: number | null
  features: Record<Feature, boolean>
}

const NENHUMA: Record<Feature, boolean> = {
  import: false, rules: false, recurring: false, planning: false,
  reports: false, reportsFull: false, export: false, investments: false, goals: false,
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    label: 'Grátis',
    maxBoards: 2,
    importsPerMonth: 1,
    features: { ...NENHUMA, import: true },
  },
  essencial: {
    tier: 'essencial',
    label: 'Essencial',
    maxBoards: 5,
    importsPerMonth: null,
    features: {
      ...NENHUMA,
      import: true, rules: true, recurring: true, planning: true,
      reports: true, export: true, goals: true,
    },
  },
  completo: {
    tier: 'completo',
    label: 'Completo',
    maxBoards: null,
    importsPerMonth: null,
    features: {
      import: true, rules: true, recurring: true, planning: true,
      reports: true, reportsFull: true, export: true, investments: true, goals: true,
    },
  },
}

/**
 * O plano em vigor. `past_due` (renovação atrasada) mantém o plano pago: um
 * cartão recusado costuma ser problema temporário, e cortar no primeiro dia
 * perde cliente bom. Cancelado, reembolsado ou chargeback cai para o grátis.
 */
export function tierFor(status: SubscriptionStatus, plan: string | null | undefined): PlanTier {
  if (status !== 'active' && status !== 'past_due') return 'free'
  const p = (plan ?? '').toLowerCase()
  if (p.includes('completo')) return 'completo'
  if (p.includes('essencial')) return 'essencial'
  // Plano pago de nome desconhecido não pode virar "grátis" na cara do
  // cliente que pagou — na dúvida, entrega o mais completo.
  return 'completo'
}

export const FEATURE_LABEL: Record<Feature, string> = {
  import: 'Importação de extrato',
  rules: 'Regras automáticas',
  recurring: 'Recorrências e parcelas',
  planning: 'Planejamento mensal',
  reports: 'Relatórios',
  reportsFull: 'Relatórios anual, parcelas, fixos e investimentos',
  export: 'Exportar em CSV',
  investments: 'Investimentos',
  goals: 'Metas',
}

/** O plano mais barato que libera cada recurso — é o que o aviso oferece. */
export function requiredTier(feature: Feature): PlanTier {
  if (PLANS.essencial.features[feature]) return 'essencial'
  return 'completo'
}

// ── Preços ──────────────────────────────────────────────────────────────────
export type BillingPeriod = 'mensal' | 'anual'

/**
 * Valores fixos, iguais aos das ofertas cadastradas na Cakto — não calculados
 * a partir do mensal. O anual é número redondo de anúncio (R$ 297 / R$ 497),
 * e derivar de uma porcentagem daria 304,98 e 508,98: o site mostraria um
 * valor e o checkout cobraria outro.
 *
 * Mudou o preço na Cakto? Mude aqui também. São os dois lugares.
 */
const PRECOS: Record<Exclude<PlanTier, 'free'>, Record<BillingPeriod, number>> = {
  essencial: { mensal: 29.9, anual: 297 },
  completo: { mensal: 49.9, anual: 497 },
}

export interface Preco {
  /** Cobrado por mês (no anual, o valor do ano dividido por 12). */
  porMes: number
  /** O que sai do bolso na hora. */
  total: number
  /** Quanto o anual economiza em um ano. */
  economia: number
  /** Desconto do anual, em pontos percentuais inteiros. */
  descontoPct: number
}

export function precoDe(tier: PlanTier, periodo: BillingPeriod): Preco | null {
  if (tier === 'free') return null
  const { mensal, anual } = PRECOS[tier]
  if (periodo === 'mensal') return { porMes: mensal, total: mensal, economia: 0, descontoPct: 0 }
  const cheio = mensal * 12
  return {
    porMes: anual / 12,
    total: anual,
    economia: cheio - anual,
    descontoPct: Math.round(((cheio - anual) / cheio) * 100),
  }
}

/** Maior desconto anual entre os planos — é o número que o selo anuncia. */
export function maiorDescontoAnual(): number {
  return Math.max(
    ...(['essencial', 'completo'] as const).map(t => precoDe(t, 'anual')!.descontoPct),
  )
}

export const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
