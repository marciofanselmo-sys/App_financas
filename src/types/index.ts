export type TransactionType = 'receita' | 'despesa' | 'transferencia'
export type CategoryType = 'receita' | 'despesa' | 'transferencia' | 'ambos'
export type BoardType = 'entrada' | 'saida' | 'ambos'
export type BoardIconKey =
  | 'wallet' | 'credit-card' | 'building' | 'shopping-cart'
  | 'home' | 'briefcase' | 'piggy-bank' | 'trending-up'
  | 'receipt' | 'car' | 'coins' | 'dollar-sign'

export interface SpecialCategoryDate {
  month: number
  year: number
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  color: string
  created_at: string
  // Categoria especial: só é uma opção válida em transações cuja data caia em um
  // dos meses/anos desta lista (ex: "Viagem" em fevereiro/2026 e março/2026).
  // Lista vazia = categoria normal, sempre disponível.
  special_dates?: SpecialCategoryDate[]
}

export interface TransactionBoard {
  id: string
  user_id: string
  name: string
  color: string
  icon: BoardIconKey
  description?: string
  type: BoardType
  is_investment: boolean
  show_on_dashboard: boolean
  last_position_import?: BoardPositionImport
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  description: string
  amount: number
  date: string
  type: TransactionType
  category: string
  board_id?: string | null
  tags?: string[]
  installment_current?: number | null
  installment_total?: number | null
  group_label?: string | null
  is_recurring?: boolean
  created_at: string
}

// Subcategoria: agrupador de gastos recorrentes exclusivo da aba Recorrências
// (guardado em user_metadata, não é uma tabela). Tem um tipo fixo (igual
// transação) pra só poder ser atribuída a itens recorrentes do mesmo tipo.
export interface Subcategory {
  name: string
  type: TransactionType
  // Categorias atreladas a este grupo — qualquer transação com uma dessas
  // categorias (do mesmo tipo) entra automaticamente no grupo, inclusive
  // transações futuras/importadas depois da atribuição (ver use-subcategories.ts).
  categories?: string[]
}

export interface TransactionFilters {
  month?: number
  year?: number
  category?: string
  type?: TransactionType
  search?: string
  board_id?: string
  tag?: string
  exclude_board_ids?: string[]
}

export interface DashboardSummary {
  totalIncome: number
  totalExpenses: number
  balance: number
}

// Categorias padrão criadas automaticamente para novos usuários
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Salário',      type: 'receita', color: '#10b981' },
  { name: 'Freelance',    type: 'receita', color: '#06b6d4' },
  { name: 'Alimentação',  type: 'despesa', color: '#f59e0b' },
  { name: 'Transporte',   type: 'despesa', color: '#3b82f6' },
  { name: 'Moradia',      type: 'despesa', color: '#8b5cf6' },
  { name: 'Saúde',        type: 'despesa', color: '#ef4444' },
  { name: 'Educação',     type: 'despesa', color: '#ec4899' },
  { name: 'Lazer',        type: 'despesa', color: '#f97316' },
  { name: 'Outros',       type: 'ambos',   color: '#6b7280' },
]

export interface RICOPosition {
  ticker: string
  value: number
  allocation: string
  rentabilidade: string
  quantity?: string
  avgPrice?: number
  lastPrice?: number
  category: string    // ex: "Fundos Imobiliários", "Ações"
  subcategory: string // ex: "Fundos Listados", "Renda Variável Brasil"
}

// Rendimento/dividendo/JCP já provisionado pela corretora, com data prevista
// de pagamento — ainda não caiu na conta, é um "a receber".
export interface RICOProvento {
  ticker: string
  quantity: string
  allocation: string
  grossValue: number
  netValue: number
  event: string
  paymentDate: string // YYYY-MM-DD
  category: string
  subcategory: string
}

// Snapshot de posição da carteira (PosicaoDetalhada.xlsx) importado numa
// conta de investimento — mesmo formato usado em GoalImport, pra exibir a
// mesma organização por categoria/subcategoria também em Investimentos.
export interface BoardPositionImport {
  patrimonio: number
  totalInvestido: number
  saldoDisponivel: number
  positions: RICOPosition[]
  proventos: RICOProvento[]
  importedAt: string
}

export interface GoalImport {
  importedAt: string
  patrimonio: number        // valor que vira currentAmount
  source?: 'rico' | 'ofx' | 'board'  // undefined = legado RICO

  // RICO-specific (source === 'rico' ou undefined)
  totalInvestido?: number
  saldoDisponivel?: number
  positions?: RICOPosition[]

  // OFX-specific (source === 'ofx')
  bankName?: string
  accountType?: string
  availBalance?: number
  balanceDate?: string

  // board-specific (source === 'board') — puxa só o patrimônio de uma conta de
  // investimento já existente, sem trazer posições/proventos pro card da meta.
  // boardId permite reatualizar com 1 clique depois; boardName é uma foto do
  // nome no momento do vínculo, pra continuar exibindo algo coerente mesmo se
  // a conta for renomeada ou excluída depois.
  boardId?: string
  boardName?: string
}

export type GoalType = 'reserva' | 'investimento' | 'carro' | 'viagem' | 'divida' | 'imovel' | 'personalizada'

export interface Goal {
  id: string
  user_id: string
  name: string
  type: GoalType
  targetAmount: number
  currentAmount: number
  deadline: string // YYYY-MM
  color: string
  created_at: string
  lastImport?: GoalImport
}

export const GOAL_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]

export const BOARD_COLORS = GOAL_COLORS

export const BOARD_ICONS: { key: BoardIconKey; label: string }[] = [
  { key: 'wallet',        label: 'Carteira' },
  { key: 'credit-card',  label: 'Cartão' },
  { key: 'building',     label: 'Banco' },
  { key: 'shopping-cart',label: 'Compras' },
  { key: 'home',         label: 'Casa' },
  { key: 'briefcase',    label: 'Trabalho' },
  { key: 'piggy-bank',   label: 'Poupança' },
  { key: 'trending-up',  label: 'Investimento' },
  { key: 'receipt',      label: 'Conta' },
  { key: 'car',          label: 'Transporte' },
  { key: 'coins',        label: 'Moedas' },
  { key: 'dollar-sign',  label: 'Dinheiro' },
]

export const CATEGORY_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#f97316',
  '#14b8a6', '#6366f1', '#84cc16', '#6b7280',
]

// Cor fixa para categorias de transferência — mesmo cinza neutro usado em
// toda a UI para representar transferência (tabelas, relatórios, "Outros").
export const TRANSFER_CATEGORY_COLOR = '#6b7280'
