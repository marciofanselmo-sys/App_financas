import type { SubscriptionStatus } from '@/hooks/use-subscription'

/**
 * Os planos do NOBLI, num lugar só: o grátis e três pagos, que se chamam
 * pelo período de cobrança — Mensal, Trimestral e Anual. Quanto maior o
 * compromisso, mais o plano libera:
 *
 *  - Grátis     → 1 conta e 1 importação por mês, para conhecer o app
 *  - Mensal     → até 3 contas e 3 importações por mês, relatório mensal
 *  - Trimestral → até 5 contas e 5 importações, todos os relatórios e CSV
 *  - Anual      → tudo sem limite, inclusive investimentos e PDF
 *
 * Regra do histórico (29/09/2026): cada plano tem uma **janela** de meses que
 * o app carrega e mostra. Nada é apagado — o que fica fora da janela continua
 * no banco e reaparece inteiro quando a pessoa assina (ou volta a assinar).
 *
 * A janela existe por dois motivos que andam juntos. O primeiro é técnico: as
 * telas buscam o histórico do usuário para somar no navegador, então o custo
 * de banda cresce com o tamanho do histórico — sem recorte, o assinante Anual
 * é o mais caro de servir. O segundo é comercial: ver o próprio passado é o
 * motivo mais concreto para subir de plano.
 *
 * As janelas respeitam o que cada plano entrega: Recorrências precisa de 2
 * meses (Mensal tem 12) e o Relatório Anual precisa de 12 (Trimestral tem 24).
 * Nenhuma tela liberada por um plano fica vazia por causa da janela dele.
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
  | 'export'        // exportar lançamentos em CSV
  | 'exportPdf'     // salvar relatórios em PDF
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
  '/ajustes':        'rules',
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
  /**
   * Meses de histórico que o app carrega, contados do primeiro dia do mês
   * atual para trás. O que ficar fora continua guardado, só não é buscado.
   */
  mesesHistorico: number
  features: Record<Feature, boolean>
}

const NENHUMA: Record<Feature, boolean> = {
  import: false, rules: false, recurring: false, planning: false,
  reports: false, reportsFull: false, export: false, exportPdf: false, investments: false, goals: false,
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: 'free',
    label: 'Grátis',
    meses: 0,
    maxBoards: 1,
    importsPerMonth: 1,
    mesesHistorico: 6,
    features: { ...NENHUMA, import: true },
  },
  mensal: {
    tier: 'mensal',
    label: 'Mensal',
    meses: 1,
    maxBoards: 3,
    importsPerMonth: 3,
    mesesHistorico: 12,
    features: {
      ...NENHUMA,
      import: true, rules: true, recurring: true, planning: true,
      reports: true, goals: true,
    },
  },
  trimestral: {
    tier: 'trimestral',
    label: 'Trimestral',
    meses: 3,
    maxBoards: 5,
    importsPerMonth: 5,
    mesesHistorico: 24,
    features: {
      ...NENHUMA,
      import: true, rules: true, recurring: true, planning: true,
      reports: true, reportsFull: true, export: true, goals: true,
    },
  },
  anual: {
    tier: 'anual',
    label: 'Anual',
    meses: 12,
    maxBoards: null,
    importsPerMonth: null,
    mesesHistorico: 36,
    features: {
      import: true, rules: true, recurring: true, planning: true,
      reports: true, reportsFull: true, export: true, exportPdf: true, investments: true, goals: true,
    },
  },
}

/**
 * Plano em vigor durante o teste grátis de 7 dias (decidido em 07/10/2026):
 * o Grátis + as telas que as tarefas da jornada usam (fixos, planejamento,
 * metas, regras/ajustes) e espaço para a 2ª conta com importação. Relatórios,
 * investimentos e exportações seguem fechados (viram vitrine).
 */
export const TRIAL_PLAN: PlanDefinition = {
  ...PLANS.free,
  label: 'Teste',
  maxBoards: 3,
  importsPerMonth: 3,
  features: { ...PLANS.free.features, rules: true, recurring: true, planning: true, goals: true },
}

/**
 * Primeiro dia do histórico visível, no formato que o banco entende
 * (`YYYY-MM-DD`). Conta do primeiro dia do mês atual para trás, para o recorte
 * não mudar no meio do mês: quem tem 6 meses em 30/09 continua vendo abril
 * inteiro no dia 1º de outubro, não um pedaço dele.
 */
export function inicioDoHistorico(tier: PlanTier, hoje = new Date()): string {
  const meses = PLANS[tier].mesesHistorico
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1)
  const mes = String(inicio.getMonth() + 1).padStart(2, '0')
  return `${inicio.getFullYear()}-${mes}-01`
}

/** "últimos 12 meses" / "últimos 3 anos" — o mesmo texto em toda a interface. */
export function textoJanela(tier: PlanTier): string {
  const meses = PLANS[tier].mesesHistorico
  if (meses % 12 === 0 && meses >= 24) return `últimos ${meses / 12} anos`
  if (meses === 12) return 'últimos 12 meses'
  return `últimos ${meses} meses`
}

/**
 * Converte o que está gravado em `subscriptions.plan` no plano em vigor.
 *
 * Os valores antigos (essencial_mensal, completo_anual…) continuam valendo
 * para quem assinou antes da troca: Essencial vira Trimestral (o que mantém
 * as 5 contas e o CSV que a pessoa já tinha), e Completo vira Anual. Por isso são testados antes dos novos — senão
 * "essencial_anual" viraria Anual pelo sufixo.
 */
export function tierDoPlano(plan: string | null | undefined): PlanTier | null {
  const p = (plan ?? '').toLowerCase()
  if (p.includes('completo')) return 'anual'
  if (p.includes('essencial')) return 'trimestral'
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
  export: 'Exportar em CSV',
  exportPdf: 'Salvar relatórios em PDF',
  investments: 'Investimentos',
  goals: 'Metas',
}

/**
 * O plano mais barato com mais espaço que o atual num limite (contas ou
 * importações) — é o que o aviso oferece quando a pessoa bate no teto.
 */
export function planoComMais(atual: PlanTier, limite: 'maxBoards' | 'importsPerMonth'): PaidTier {
  const agora = PLANS[atual][limite]
  return PAID_TIERS.find(t => {
    const v = PLANS[t][limite]
    return v === null || (agora !== null && v > agora)
  }) ?? 'anual'
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
  mensal: 21,
  trimestral: 49,
  anual: 169,
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
 * Como cada plano se apresenta: para quem é, e o que acrescenta ao plano de
 * baixo ("Tudo do Mensal, mais: …"). Usado na tela de assinatura, na landing
 * e no aviso de bloqueio — texto num lugar só, para as três telas nunca
 * prometerem coisas diferentes.
 *
 * A escada funciona porque cada plano libera tudo do anterior. Se um dia um
 * plano maior deixar de ter algo do menor, o "Tudo do X" vira mentira.
 */
export interface PlanCopy {
  /** Uma linha: para quem é o plano. */
  tagline: string
  /** Plano de baixo que este inclui por inteiro; ausente no Grátis. */
  inclui?: PlanTier
  itens: string[]
}

export const PLAN_COPY: Record<PlanTier, PlanCopy> = {
  free: {
    tagline: 'Para conhecer o NOBLI sem gastar nada.',
    itens: [
      'Categorização automática: aprende com cada correção sua',
      '1 conta ou cartão',
      '1 importação de extrato por mês',
      'Lançamentos, categorias e eventos sem limite',
      'Histórico dos últimos 6 meses',
      'Nada é apagado: o que passa de 6 meses fica guardado e volta quando você assina',
    ],
  },
  mensal: {
    tagline: 'Para organizar o dia a dia das suas contas.',
    inclui: 'free',
    itens: [
      'Até 3 contas e cartões',
      '3 importações de extrato por mês',
      'Gastos fixos, parcelas e recorrências no automático',
      'Planejamento do mês e metas',
      'Relatório mensal',
      'Histórico dos últimos 12 meses',
      'Tela de regras para ajustar a automação',
    ],
  },
  trimestral: {
    tagline: 'Para quem tem várias contas e quer ver o todo.',
    inclui: 'mensal',
    itens: [
      'Até 5 contas e cartões',
      '5 importações de extrato por mês',
      'Relatórios anual, de parcelas e de gastos fixos',
      'Histórico dos últimos 2 anos',
      'Exportação dos lançamentos em CSV',
    ],
  },
  anual: {
    tagline: 'Controle total, sem limite, pelo menor preço por mês.',
    inclui: 'trimestral',
    itens: [
      'Contas e cartões ilimitados',
      'Importação de extrato sem limite',
      'Histórico dos últimos 3 anos',
      'Carteira de investimentos com proventos',
      'Relatórios em PDF',
    ],
  },
}

/** "Tudo do Mensal, mais:" — ou nada, no Grátis. */
export function incluiTexto(tier: PlanTier): string | null {
  const base = PLAN_COPY[tier].inclui
  return base ? `Tudo do ${PLANS[base].label}, mais:` : null
}
