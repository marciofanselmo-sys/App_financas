import type { SubscriptionStatus } from '@/hooks/use-subscription'

/**
 * Os planos do NOBLI, num lugar só: o grátis e três pagos, que se chamam
 * pelo período de cobrança — Mensal, Trimestral e Anual. Quanto maior o
 * compromisso, mais o plano libera:
 *
 *  - Mensal     → o essencial do dia a dia (até 5 contas, relatório mensal)
 *  - Trimestral → + contas ilimitadas e todos os relatórios, mas sem exportar
 *  - Anual      → tudo, inclusive investimentos e exportação
 *
 * Regra de ouro do recorte: **nenhum plano corta histórico**. Limitar os
 * meses de dados esvazia Recorrências (precisa de 2 meses) e o Relatório
 * Anual (precisa de 12) — entregar tela vazia é pior do que não ter a tela.
 */
export type PlanTier = 'free' | 'mensal' | 'trimestral' | 'anual'
export type PaidTier = Exclude<PlanTier, 'free'>

/** Ordem de exibição e de "degrau": do mais barato ao mais completo. */
export const PAID_TIERS: PaidTier[] = ['mensal', 'trimestral', 'anual']

export type Feature =
  | 'import'        // importar extrato
  | 'rules'         // regras automáticas
  | 'recurring'     // recorrências e parcelas
  | 'planning'      // planejamento mensal e 50/30/20
  | 'reports'       // relatórios
  | 'reportsFull'   // além do mensal: anual, parcelas, fixos, investimentos
  | 'export'        // exportar CSV e salvar relatórios em PDF
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
  /** Meses cobrados de uma vez; 0 no grátis. */
  meses: number
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
    meses: 0,
    maxBoards: 2,
    importsPerMonth: 1,
    features: { ...NENHUMA, import: true },
  },
  mensal: {
    tier: 'mensal',
    label: 'Mensal',
    meses: 1,
    maxBoards: 5,
    importsPerMonth: null,
    features: {
      ...NENHUMA,
      import: true, rules: true, recurring: true, planning: true,
      reports: true, export: true, goals: true,
    },
  },
  trimestral: {
    tier: 'trimestral',
    label: 'Trimestral',
    meses: 3,
    maxBoards: null,
    importsPerMonth: null,
    features: {
      ...NENHUMA,
      import: true, rules: true, recurring: true, planning: true,
      reports: true, reportsFull: true, goals: true,
    },
  },
  anual: {
    tier: 'anual',
    label: 'Anual',
    meses: 12,
    maxBoards: null,
    importsPerMonth: null,
    features: {
      import: true, rules: true, recurring: true, planning: true,
      reports: true, reportsFull: true, export: true, investments: true, goals: true,
    },
  },
}

/**
 * Converte o que está gravado em `subscriptions.plan` no plano em vigor.
 *
 * Os valores antigos (essencial_mensal, completo_anual…) continuam valendo
 * para quem assinou antes da troca: Essencial libera o mesmo que o Mensal, e
 * Completo o mesmo que o Anual. Por isso são testados antes dos novos — senão
 * "essencial_anual" viraria Anual pelo sufixo.
 */
export function tierDoPlano(plan: string | null | undefined): PlanTier | null {
  const p = (plan ?? '').toLowerCase()
  if (p.includes('completo')) return 'anual'
  if (p.includes('essencial')) return 'mensal'
  if (p.includes('trimestral')) return 'trimestral'
  if (p.includes('anual')) return 'anual'
  if (p.includes('mensal')) return 'mensal'
  return null
}

/**
 * O plano em vigor. `past_due` (renovação atrasada) mantém o plano pago: um
 * cartão recusado costuma ser problema temporário, e cortar no primeiro dia
 * perde cliente bom. Cancelado, reembolsado ou chargeback cai para o grátis.
 */
export function tierFor(status: SubscriptionStatus, plan: string | null | undefined): PlanTier {
  if (status !== 'active' && status !== 'past_due') return 'free'
  // Plano pago de nome desconhecido não pode virar "grátis" na cara do
  // cliente que pagou — na dúvida, entrega o mais completo.
  return tierDoPlano(plan) ?? 'anual'
}

export const FEATURE_LABEL: Record<Feature, string> = {
  import: 'Importação de extrato',
  rules: 'Regras automáticas',
  recurring: 'Recorrências e parcelas',
  planning: 'Planejamento mensal',
  reports: 'Relatórios',
  reportsFull: 'Relatórios anual, parcelas, fixos e investimentos',
  export: 'Exportar em CSV e PDF',
  investments: 'Investimentos',
  goals: 'Metas',
}

/** O plano mais barato que libera cada recurso — é o que o aviso oferece. */
export function requiredTier(feature: Feature): PaidTier {
  return PAID_TIERS.find(t => PLANS[t].features[feature]) ?? 'anual'
}

// ── Preços ──────────────────────────────────────────────────────────────────
/**
 * Valores fixos, iguais aos das ofertas cadastradas na Cakto — não calculados
 * a partir do mensal. São números redondos de anúncio, e derivar de uma
 * porcentagem faria o site mostrar um valor e o checkout cobrar outro.
 *
 * Mudou o preço na Cakto? Mude aqui também. São os dois lugares.
 */
const PRECOS: Record<PaidTier, number> = {
  mensal: 29.9,
  trimestral: 79.9,
  anual: 297,
}

export interface Preco {
  /** Equivalente por mês (o total dividido pelos meses do plano). */
  porMes: number
  /** O que sai do bolso a cada cobrança. */
  total: number
  /** Quanto economiza no período em relação a pagar o Mensal. */
  economia: number
  /** Desconto sobre o Mensal, em pontos percentuais inteiros. */
  descontoPct: number
}

export function precoDe(tier: PlanTier): Preco | null {
  if (tier === 'free') return null
  const total = PRECOS[tier]
  const meses = PLANS[tier].meses
  const cheio = PRECOS.mensal * meses
  return {
    porMes: total / meses,
    total,
    economia: cheio - total,
    descontoPct: Math.round(((cheio - total) / cheio) * 100),
  }
}

/** "a cada mês", "a cada 3 meses", "por ano" — como a cobrança se repete. */
export function periodicidade(tier: PaidTier): string {
  if (tier === 'mensal') return 'por mês'
  if (tier === 'trimestral') return 'a cada 3 meses'
  return 'por ano'
}

export const moeda = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

/**
 * O que cada plano entrega, em linguagem de venda. Usado na landing, na tela
 * de assinatura e no aviso de bloqueio — texto num lugar só para as três
 * telas nunca prometerem coisas diferentes.
 */
export const PLAN_ITEMS: Record<PlanTier, string[]> = {
  free: [
    'Até 2 contas ou cartões',
    'Lançamentos, categorias e eventos sem limite',
    'Histórico completo, sem corte de meses',
    '1 importação de extrato por mês',
  ],
  mensal: [
    'Até 5 contas e cartões',
    'Importação de extrato sem limite',
    'Regras que categorizam sozinhas',
    'Recorrências, parcelas e planejamento mensal',
    'Relatório mensal e metas',
    'Exportação em CSV e PDF',
  ],
  trimestral: [
    'Contas e cartões ilimitados',
    'Importação de extrato sem limite',
    'Regras, recorrências, parcelas e planejamento',
    'Todos os relatórios: mensal, anual, parcelas, gastos fixos e investimentos (só na tela)',
    'Metas',
  ],
  anual: [
    'Tudo liberado, com contas ilimitadas',
    'Todos os relatórios, com exportação em CSV e PDF',
    'Carteira de investimentos com proventos e alocação',
    'Regras, recorrências, planejamento e metas',
  ],
}
